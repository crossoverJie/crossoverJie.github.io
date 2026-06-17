---
title: I Built an AI-Powered StarRocks Upgrade Risk Scanner — And It Caught a Real Risk
date: 2026/06/14 17:00:00
categories:
  - StarRocks
tags:
  - StarRocks
  - AI
banner_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615004232.png
index_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615004232.png
---

# Background

I've been working on a cross-version upgrade of StarRocks (3.3 → 3.5) and hit quite a few pitfalls along the way. I previously wrote a post on [StarRocks Upgrade Considerations](https://crossoverjie.top/2025/03/14/starrocks/StarRocks-upgrade/) documenting the manual upgrade process, but that was only for minor version upgrades (3.3.3 → 3.3.9).

Cross-major-version upgrades are an entirely different beast — between 3.3 and 3.5 there are 6000+ commits, hiding all kinds of incompatible changes: default config values changed, session variables modified, protocol fields removed... Manually reviewing each one is simply not feasible. Missing a single critical change could lead to a production incident.

So I thought: can AI help me do this job? After some iteration, I hand-crafted a StarRocks upgrade risk scanner using Claude Code ([starrocks-upgrade skill](https://github.com/crossoverJie/skills/blob/main/skills/starrocks-upgrade/SKILL.md)). This article discusses its design principles.

Before upgrading now, I run the Skill first. It prompts you to input cluster information for downstream analysis:
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260614235018.png)

After collecting that, it gathers commit diffs between the two versions, analyzes them, and generates an upgrade report highlighting potential risks, like this one:
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260614235225.png)

We actually encountered this exact issue after the upgrade — having the report in advance made resolving it much easier.

<!--more-->

# Problem Domain: Why Upgrades Are So Hard

Let's first clarify the core problem. The difficulty of cross-version StarRocks upgrades isn't the "upgrade operation" itself — it's **not knowing what will happen before upgrading**.

## Incompatible Changes Are Hard to Spot

Default config value changes, session variable modifications, BE config tweaks between versions are often buried in thousands of commits. The traditional approach is to manually read Release Notes, but many behavioral changes aren't documented in RNs at all.

## Impact Scope Is Hard to Assess

A single config default change can have cascading effects through indirect call chains. For example, `transform_type_prefer_string_for_varchar` changing from false to true looks like just a default value tweak, but it indirectly causes materialized view invalidation through MV re-activation. This kind of indirect impact chain is virtually impossible to catch by eye.

## Cluster-Specific Risks Can't Be Quantified

Different clusters have different configurations (fe.conf/be.conf), deployment methods (K8s/VM), and scales (MV count, table count). Generic upgrade advice can't cover risks specific to your cluster. The same default value change poses very different risks: if you've already overridden it in your conf, the risk is low; but if you happen to use the old default, the upgrade changes behavior directly.

## Shortcomings of Existing Approaches

| Approach | Shortcoming |
|----------|-------------|
| Manually reading Release Notes | Incomplete — many behavioral changes aren't recorded in RNs |
| `git log --oneline A..B` | Only shows commit list, can't judge compatibility risk |
| CI/CD automated tests | Only verifies functional correctness, can't catch config conflicts or operational impacts |
| Reading PRs one by one | Analysis is one-sided — looking at PR diffs alone can't reveal call chains and upstream/downstream impacts |

The PR-by-PR analysis is especially treacherous. A PR diff only shows the changed code snippet — you can't see the class context or upstream/downstream call relationships. For the `transform_type_prefer_string_for_varchar` example, the PR diff merely modifies a default value in `Config.java`, but you can't see that `AnalyzerUtils.transformTableColumnType()` reads this config, `MaterializedViewAnalyzer` calls it, and `AlterJobMgr.reActivateMV()` indirectly triggers MV re-parsing. This complete indirect impact chain is absolutely invisible from a PR diff alone.

# Core Design Choice: Full Source Code Scanning

Based on the analysis above, the tool makes a fundamental design choice: **it must run in the StarRocks source code root directory**, rather than reading GitHub diffs PR by PR.

The reason is straightforward:

| Capability | PR-by-PR Analysis | Full Source Scanning |
|-----------|-------------------|---------------------|
| Identifying removed config items | No (deleted lines don't appear in PR diffs) | Yes — parses Config.java from both versions and compares field sets |
| Tracing indirect call chains | No — lacks source context | Yes — recursive grep in the source tree |
| Cluster config conflict detection | No — can't read user conf files | Yes — parses cluster-profile.yaml and cross-references with Scanner results |
| Identifying "default changed but user hasn't overridden" | No | Yes — compares conf values against old/new defaults |

In short: **no source context, no deep analysis.**

# Design Philosophy: Prefer False Positives Over False Negatives

The tool's core design philosophy is **prefer false positives over false negatives**.

The reason is simple: the cost of upgrade risks is asymmetric. Missing an incompatible change could cause a production incident, while a false positive only adds manual verification work. So the tool employs a multi-layered scanning strategy: 11 specialized Scanners covering known risk patterns + per-commit Tier classification to ensure nothing is missed.

# Overall Architecture

The tool's workflow is divided into four phases. Here's the big picture:

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images202606171733496.png)

## Phase 1: Data Collection

This is the foundation of the entire tool, implemented by `starrocks_upgrade.py`. It does quite a lot:

### Git Commit Diff Collection

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/imagesmac_1781454655007.png)

It uses `git log branchA..branchB` to get commits unique to the target branch, then classifies each commit. There's a key optimization here — using custom delimiters (SOH/STX) to fetch all commit details in a single `git log` call, avoiding N+1 queries.

### Commit Tier Classification

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615003636.png)

Not every commit needs deep analysis. The tool classifies commits into four tiers:

| Tier | Match Criteria | Handling |
|------|---------------|----------|
| SKIP | test/docs/build directories; commit prefix is build/chore/ci/style | Count only |
| HIGH | Core paths: FE optimizer/executor/SQL parsing, BE runtime/storage, Protocol/IDL | Save full diff + deep analysis |
| MEDIUM | Business paths: connectors/auth/permissions; feat/fix type source changes | Save full diff + analysis |
| LOW | All other changes | Save metadata only |

This way, HIGH/MEDIUM commits get deep analysis, while LOW/SKIP commits don't waste resources.

### 11 Specialized Scanners

This is the most critical part of the tool, covering 11 dimensions of upgrade risk:

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615003917.png)

**FE side:**
- Config Scanner — scans `@ConfField` config changes in `Config.java`
- Session Variable Scanner — scans `@VarAttr` variable changes in `SessionVariable.java`
- System Variable Scanner — scans `GlobalVariable.java`
- Auth Scanner — scans `AuthenticationManager.java`, `PrivilegeManager.java`

**BE side:**
- BE Config Scanner — scans `CONF_*` macro definitions in `config.h`
- Storage Format Scanner — scans `segment_format.h`, `tablet_meta.h`

**IDL/Protocol:**
- Protocol Scanner — scans `.thrift` / `.proto` file changes
- Parser Scanner — scans `StarRocksParser.g4`, `AstBuilder.java`

**Data/Types:**
- Charset/Collation Scanner — scans `Collation*.java`
- Type System Scanner — scans `ScalarType.java` / `Column.java`
- MV Scanner — scans `MaterializedView.java`, `MVRefreshParams.java`

Every Scanner follows the same workflow:

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615004232.png)

### Config Scanner's State Machine Parsing

This deserves a closer look, since Config.java parsing is the most complex part of the tool.

Java annotations can span multiple lines:

```java
@ConfField(mutable = true, comment = "Whether to prefer string type "
        + "for fixed length varchar column in materialized view creation/ctas")
public static boolean transform_type_prefer_string_for_varchar = true;
```

So the parser uses a **line-by-line state machine** approach:

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615004523.png)

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615004849.png)

The state machine tracks `(` and `)` pairing, concatenates multi-line annotations, then parses the `mutable` and `comment` attributes. Compared to simple regex matching, this approach correctly handles various edge cases.

### BE Config Parsing

The BE side uses C++ macro definitions for configuration, requiring a completely different parsing approach:

```cpp
CONF_Bool(datacache_auto_adjust_enable, "false")     // Not runtime-modifiable
CONF_mBool(lake_enable_alter_struct, "true")          // Runtime-modifiable (m prefix)
```

The regex `CONF_(m?\w+)\((\w+),\s*"([^"]*)"\)` extracts everything in one pass. Note that the `m` prefix indicates mutable — runtime-modifiable.

### Cluster Config Conflict Detection

This is the feature I find most useful. The risk of the same default value change varies dramatically across scenarios:

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615005115.png)

| Scenario | Example | Risk |
|----------|---------|------|
| Config removed + you have it in conf | `mysql_service_nio_enabled` deleted, you have `= true` in conf | HIGH — startup error |
| Default changed + you use old default | `enable_load_volume_from_conf` true→false, you have `= true` in conf | MEDIUM — your override takes effect, but decide whether to follow |
| Default changed + you have custom value | You set `= custom_value` in conf | LOW — your override takes priority |
| Default changed + you haven't overridden | `mysql_server_version` 5.1.0→8.0.33, not in your conf | HIGH — new default takes effect automatically |

This precise distinction is far more useful than vaguely saying "some config default changed."

### Deployment-Aware

The tool also generates deployment-specific risk alerts based on the cluster's deployment method:

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615005328.png)

For example, in a K8s environment, FE Pod restarts trigger MV re-activation. If there are MV-related code changes, this could cause schema incompatibilities. In VM environments, the focus is more on upgrade order (BE first, then FE).

## Phase 2: Commit Diff Analysis

Phase 1 saved the full diffs of HIGH/MEDIUM commits. Phase 2 is executed by AI Agents, using parallel subagents for deep compatibility analysis of commits.

Since cross-version diffs typically have a large number of commits (1361 HIGH tier commits for 3.3→3.5), sequential analysis is impractical. So commits are grouped by module, with 5-8 commits per group assigned to a parallel subagent:

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615005547.png)

Each subagent outputs structured analysis results: `compatibility_impact`, `impact_type`, `severity`, `error_scenario`, `reproduction`, `rollback`.

## Phase 3: Deep Impact Analysis

All CRITICAL/HIGH level findings from Phase 2's output + Phase 1's Scanner results require further deep analysis. Each (or each batch of related) findings is assigned a parallel subagent that traces call chains via grep in the source tree.

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615005815.png)

This is one of the tool's most distinctive designs — **system lifecycle entry-point tracing**. A config change may not be directly referenced by lifecycle code, but reaches it through an indirect call chain:

```
transform_type_prefer_string_for_varchar (Config)
  └─ AnalyzerUtils.transformTableColumnType() (direct caller)
       └─ MaterializedViewAnalyzer (indirect caller)
            └─ AlterJobMgr.reActivateMV() (system lifecycle entry: triggered on FE restart)
```

Without tracing this indirect path, you'd miss the critical risk of "MV re-activation failure after FE restart."

## Phase 4: Report Synthesis

All analysis results from Phases 1-3 are synthesized into a structured upgrade report.

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615010857.png)

The report's core design principles:

1. **INCOMPATIBLE CHANGES at the top**: The most critical information comes first, sorted by CRITICAL > HIGH
2. **Error scenarios categorized by trigger timing**: After FE restart / After CN restart / Daily queries / During upgrade
3. **Cluster-specific conflict detection**: Only conflicts relevant to the user's cluster configuration are shown
4. **Actionable Upgrade Checklist**: Every step is concrete and executable

### Full Data Flow Diagram

Looking at Phase 1's data flow as a whole makes it clearer:

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615011151.png)

# Unified Impact Model

All Scanner findings use a unified four-dimensional impact model:

| Dimension | Meaning | Trigger Condition Example |
|-----------|---------|--------------------------|
| `data` | Affects existing data | `transform_type_prefer_string_for_varchar`, `max_varchar_length` |
| `behavior` | Same SQL may return different results | `sql_mode`, `mysql_server_version` |
| `operational` | Requires config/ops changes | Any HIGH_RISK config change |
| `rolling_upgrade` | Mixed-version cluster may break | `protocol_field_removed`, `storage_format_changed` |

Every finding includes a four-dimensional assessment, making it easy to filter and aggregate by dimension.

# Summary

The design philosophy of this tool can be distilled into these key points:

1. **Source code is truth**: All analysis is built on the complete source tree, not on PR diff snippets returned by GitHub API. No source context, no deep analysis.

2. **Layered processing**: Not every commit deserves deep analysis. The tier classification strategy ensures critical commits get deep analysis while low-risk commits don't waste resources.

3. **Specialized Scanners + AI Agent combination**: Python scripts handle deterministic data collection and pattern matching (11 Scanners), while AI Agents handle uncertain deep analysis (call chain tracing, impact assessment). Each plays to its strengths.

4. **Cluster-specific**: Instead of generic advice, it cross-references the user's actual fe.conf/be.conf to precisely identify cluster-specific risks.

5. **Prefer false positives over false negatives**: The cost of upgrade risks is asymmetric — the cost of a missed finding far outweighs a false alarm.

There are also limitations: Protocol/Parser Scanner precision is limited, indirect call chain tracing depends on AI Agent capability, runtime behavioral changes can't be detected, and large repo performance is an issue (6000+ commits take 30+ minutes). These are areas for future improvement.

If you also maintain StarRocks clusters and frequently need cross-version upgrades, give this tool a try. At least in my case, it helped me discover several incompatible changes that weren't mentioned in the Release Notes.

For large-scale projects like this, complex contextual analysis is exactly where LLMs excel — making them perfectly suited for this kind of previously manual labor-intensive work.
