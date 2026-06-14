---
title: 我做了一个 StarRocks 升级风险扫描工具，直接帮我定位到一个风险
date: 2026/06/14 17:00:00
categories:
  - StarRocks
tags:
  - StarRocks
  - AI
banner_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615004232.png
index_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615004232.png
---

# 背景

最近在搞 StarRocks 的跨版本升级（3.3 → 3.5），中间踩了不少坑。我之前也写过一篇 [StarRocks 升级注意事项](https://crossoverjie.top/2025/03/14/starrocks/StarRocks-upgrade/)记录了手动升级的流程，但那只是针对小版本（3.3.3 → 3.3.9）的升级。

跨大版本升级完全是另一回事——3.3 到 3.5 中间有 6000+ 个 commit，里面藏着各种不兼容变更：配置默认值变了、Session Variable 改了、Protocol 字段删了……人工逐个审查根本不现实，漏一个关键变更就可能导致生产事故。

于是我就想：能不能用 AI 来帮我干这活？经过一段时间的迭代，我用 Claude Code 手搓了一个 StarRocks 升级风险扫描工具（[starrocks-upgrade skill](https://github.com/crossoverJie/skills/blob/main/skills/starrocks-upgrade/SKILL.md)），这篇文章就来聊聊它的设计原理。

现在升级之前会先执行一次 Skill，它首先会让你输入一些集群信息方便后面做具体的分析：
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260614235018.png)

收集完成之后便会收集差异版本之间的 commit 信息开始分析，最终生成一个升级报告，给出一些潜在的风险，比如这个：
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260614235225.png)

我们在升级之后确实遇到了这个问题，提前有了这份报告之后解决起来自然也要轻松许多。

<!--more-->

# 问题域：为什么升级这么难

先说清楚我们要解决的核心问题。StarRocks 跨版本升级的难点不在于"升级操作"本身，而在于**升级前不知道会发生什么**。

## 不兼容变更难以发现

版本间的配置项默认值变化、Session Variable 变更、BE 配置修改等，往往隐藏在几千个 commit 中。传统做法是人工阅读 Release Notes，但很多行为变更根本不会记录在 RN 里。

## 影响范围难以评估

一个配置项的默认值变化可能通过间接调用链产生连锁反应。比如 `transform_type_prefer_string_for_varchar` 从 false 变为 true，看起来只是改了个默认值，但它会通过 MV re-activation 间接导致物化视图失效。这种间接影响链靠肉眼根本发现不了。

## 集群特定风险无法量化

不同集群的配置（fe.conf/be.conf）、部署方式（K8s/VM）、规模（MV 数量、表数量）各不相同，通用的升级建议无法覆盖特定集群的风险。同样是默认值变了，你的集群如果已经在 conf 中覆盖了，风险就很低；但如果你用的恰好是旧默认值，升级后行为就直接变了。

## 现有方案的不足

| 方案 | 不足 |
|------|------|
| 人工阅读 Release Notes | 不完整，很多行为变更不记录在 RN 中 |
| `git log --oneline A..B` | 只能看到 commit 列表，无法判断兼容性风险 |
| CI/CD 自动化测试 | 只能验证功能正确性，无法发现配置冲突、运维影响 |
| 逐个 PR 阅读分析 | 分析片面——只看 PR diff 无法了解调用链和上下游影响 |

特别是逐 PR 分析，这是最容易掉进去的坑。一个 PR 的 diff 只是变更的代码片段，你根本看不到变更所在的类与上下游调用关系。比如上面提到的 `transform_type_prefer_string_for_varchar`，PR diff 中只是修改了 `Config.java` 中的一个默认值，但你看不到 `AnalyzerUtils.transformTableColumnType()` 在读这个配置、`MaterializedViewAnalyzer` 调用了它、`AlterJobMgr.reActivateMV()` 又间接触发了 MV 重新解析——这条完整的间接影响链，只看 PR diff 是绝对看不出来的。

# 核心设计选择：源码全量扫描

基于上面的分析，工具做了一个根本性的设计选择：**必须在 StarRocks 源码根目录下运行**，而不是逐个 PR 读取 GitHub 上的 diff。

这个选择的原因很简单：

| 能力 | 逐 PR 分析 | 源码全量扫描 |
|------|-----------|------------|
| 识别配置项移除 | 不行（已删除的行不会出现在 PR diff 中） | 可以——全量解析新旧版本的 Config.java，对比字段集合 |
| 追踪间接调用链 | 不行——缺少源码上下文 | 可以——在源码树中 grep 递归追踪 |
| 集群配置冲突检测 | 不行——无法读取用户 conf | 可以——解析 cluster-profile.yaml 并与 Scanner 结果交叉对比 |
| 识别"默认值变更但用户未覆盖" | 不行 | 可以——对比 conf 中的值与新旧默认值 |

简单来说：**没有源码上下文，就没有深度分析。**

# 设计哲学：宁可误报也不漏报

这个工具的核心设计哲学是 **prefer false positives over false negatives**。

原因很简单：升级风险的成本是非对称的。漏报一个不兼容变更可能导致生产事故，而误报只是增加了人工验证的工作量。所以工具采用了多层级扫描策略：11 个专项 Scanner 覆盖已知风险模式 + 逐 commit Tier 分类确保无遗漏。

# 整体架构

整个工具的工作流分为四个阶段，先看一张全局视图：

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615002106.png)

## Phase 1：数据收集

这是整个工具的基础，由 `starrocks_upgrade.py` 实现。它要做的事情很多：

### Git Commit Diff 采集

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/imagesmac_1781454655007.png)


通过 `git log branchA..branchB` 获取目标分支独有的 commits，然后对每个 commit 做分类。这里有个关键优化——使用自定义分隔符（SOH/STX）通过单次 `git log` 调用获取所有 commit 的完整信息，避免 N+1 查询。

### Commit Tier 分类

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615003636.png)


不是所有 commit 都需要深度分析。工具把 commit 分成四级：

| Tier | 匹配规则 | 处理方式 |
|------|---------|---------|
| SKIP | test/docs/build 目录；commit 前缀为 build/chore/ci/style | 仅统计数量 |
| HIGH | 核心路径：FE 优化器/执行器/SQL 解析、BE runtime/storage、Protocol/IDL | 保存完整 diff + 深度分析 |
| MEDIUM | 业务路径：连接器/认证/权限；feat/fix 类型的源码变更 | 保存完整 diff + 分析 |
| LOW | 其他所有变更 | 仅保存元数据 |

这样 HIGH/MEDIUM 的 commit 得到深度分析，LOW/SKIP 不浪费资源。

### 11 个专项 Scanner

这是工具最核心的部分，覆盖了升级风险的 11 个维度：

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615003917.png)


**FE 侧：**
- Config Scanner — 扫描 `Config.java` 中的 `@ConfField` 配置项变更
- Session Variable Scanner — 扫描 `SessionVariable.java` 中的 `@VarAttr` 变量变更
- System Variable Scanner — 扫描 `GlobalVariable.java`
- Auth Scanner — 扫描 `AuthenticationManager.java`、`PrivilegeManager.java`

**BE 侧：**
- BE Config Scanner — 扫描 `config.h` 中的 `CONF_*` 宏定义
- Storage Format Scanner — 扫描 `segment_format.h`、`tablet_meta.h`

**IDL/协议：**
- Protocol Scanner — 扫描 `.thrift` / `.proto` 文件变更
- Parser Scanner — 扫描 `StarRocksParser.g4`、`AstBuilder.java`

**数据/类型：**
- Charset/Collation Scanner — 扫描 `Collation*.java`
- Type System Scanner — 扫描 `ScalarType.java` / `Column.java`
- MV Scanner — 扫描 `MaterializedView.java`、`MVRefreshParams.java`

每个 Scanner 的工作模式都一样：

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615004232.png)


### Config Scanner 的状态机解析

这里值得展开说说，因为 Config.java 的解析是整个工具中最复杂的部分。

Java 注解可能跨多行：

```java
@ConfField(mutable = true, comment = "Whether to prefer string type "
        + "for fixed length varchar column in materialized view creation/ctas")
public static boolean transform_type_prefer_string_for_varchar = true;
```

所以解析器采用了**逐行状态机**模式：

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615004523.png)

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615004849.png)


状态机跟踪 `(` 和 `)` 的配对，将多行注解拼接后再解析 `mutable` 和 `comment` 属性。相比简单的正则匹配，这种方式能正确处理各种边界情况。

### BE Config 解析

BE 端使用 C++ 宏定义配置，解析方式完全不同：

```cpp
CONF_Bool(datacache_auto_adjust_enable, "false")     // 不可运行时修改
CONF_mBool(lake_enable_alter_struct, "true")          // 可运行时修改 (m 前缀)
```

正则 `CONF_(m?\w+)\((\w+),\s*"([^"]*)"\)` 一把就能提取出来，注意 `m` 前缀表示 mutable，可运行时修改。

### 集群配置冲突检测

这是我觉得最有用的功能。不同场景下同一个默认值变化的风险完全不同：

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615005115.png)


| 场景 | 示例 | 风险 |
|------|------|------|
| 配置已移除 + 你的 conf 中有 | `mysql_service_nio_enabled` 已删除，你 conf 中有 `= true` | HIGH — 启动报错 |
| 默认值变化 + 你使用旧默认 | `enable_load_volume_from_conf` true→false，你 conf 中 `= true` | MEDIUM — 你的覆盖生效，但需决定是否跟随 |
| 默认值变化 + 你有自定义值 | 你 conf 中设了 `= custom_value` | LOW — 你的覆盖优先 |
| 默认值变化 + 你未覆盖 | `mysql_server_version` 5.1.0→8.0.33，你 conf 中没有 | HIGH — 自动采用新默认值 |

这种精确区分比泛泛地说"某个配置默认值变了"有用得多。

### 部署方式感知

工具还会根据集群的部署方式生成特定风险提示：

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615005328.png)

比如 K8s 环境下，FE Pod 重启会触发 MV re-activation，如果有 MV 相关代码变更，可能导致 schema 不兼容；VM 环境下则更关注升级顺序（BE 先 FE 后）。

## Phase 2：Commit Diff 分析

Phase 1 保存了 HIGH/MEDIUM commit 的完整 diff。Phase 2 由 AI Agent 执行，利用并行 Subagent 对 commit 进行深度兼容性分析。

由于跨版本 diff 的 commit 数量通常很大（3.3→3.5 有 1361 个 HIGH tier commit），逐个串行分析不现实。所以按模块分组，每组 5-8 个 commit 分配给一个并行 Subagent：

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615005547.png)

每个 Subagent 输出结构化的分析结果：`compatibility_impact`、`impact_type`、`severity`、`error_scenario`、`reproduction`、`rollback`。

## Phase 3：深度影响分析

Phase 2 的输出 + Phase 1 的 Scanner 发现中，所有 CRITICAL/HIGH 级别的发现需要进一步深度分析。每个（或每批相关的）发现分配一个并行 Subagent，在源码树中 grep 追踪调用链。

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615005815.png)


这是工具最独特的设计之一——**系统生命周期入口追踪**。一个配置变更可能不直接被生命周期代码引用，但通过间接调用链到达：

```
transform_type_prefer_string_for_varchar (Config)
  └─ AnalyzerUtils.transformTableColumnType() (直接调用方)
       └─ MaterializedViewAnalyzer (间接调用方)
            └─ AlterJobMgr.reActivateMV() (系统生命周期入口: FE 重启时触发)
```

如果不追踪这条间接路径，就会漏掉"FE 重启后 MV re-activation 失败"这个关键风险。

## Phase 4：报告综合

将 Phase 1-3 的所有分析结果综合为一份结构化的中文升级报告。

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615010857.png)

报告的核心设计原则：

1. **INCOMPATIBLE CHANGES 置顶**：最关键的信息放在最前面，按 CRITICAL > HIGH 排序
2. **按触发时机分类报错场景**：FE 重启后 / CN 重启后 / 日常查询 / 升级过程中
3. **集群特定的冲突检测**：只有与用户集群配置相关的冲突才展示
4. **可操作的 Upgrade Checklist**：每个步骤都是具体的、可执行的

### 数据流全图

把 Phase 1 的数据流串起来看会更清晰：

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260615011151.png)

# 统一影响模型

所有 Scanner 的发现都使用统一的四维影响模型：

| 维度 | 含义 | 触发条件示例 |
|------|------|-------------|
| `data` | 影响现有数据 | `transform_type_prefer_string_for_varchar`、`max_varchar_length` |
| `behavior` | 相同 SQL 可能返回不同结果 | `sql_mode`、`mysql_server_version` |
| `operational` | 需要配置/运维变更 | 任一 HIGH_RISK 配置变更 |
| `rolling_upgrade` | 混合版本集群可能中断 | `protocol_field_removed`、`storage_format_changed` |

每个发现都附带四维评估，便于按维度筛选和汇总。

# 总结

这个工具的设计思路可以归结为以下几点：

1. **源码是真理**：所有分析都建立在完整的源码树上，而不是 GitHub API 返回的 PR diff 片段。没有源码上下文，就没有深度分析。

2. **分层处理**：不是所有 commit 都值得深度分析，Tier 分类的分层策略确保关键 commit 得到深度分析，低风险 commit 不浪费资源。

3. **专项 Scanner + AI Agent 的组合**：Python 脚本做确定性的数据收集和模式匹配（11 个 Scanner），AI Agent 做不确定性的深度分析（调用链追踪、影响评估）。各取所长。

4. **集群特定**：不是给出通用建议，而是结合用户实际的 fe.conf/be.conf，精确识别集群特定风险。

5. **宁可误报也不漏报**：升级风险的成本是非对称的，漏报的代价远大于误报。

当然也有局限性：Protocol/Parser Scanner 精度有限、间接调用链追踪依赖 AI Agent 的能力、无法检测运行时行为变化、大仓库性能问题（6000+ commit 需要 30 分钟以上）。这些也是后续改进的方向。

如果你也在维护 StarRocks 集群并且经常需要跨版本升级，可以试试这个工具。至少在我这边，它帮我发现了好几个 Release Notes 里没提到的不兼容变更。

对于这种大型项目，存在复杂的上下文分析完全是现在 LLM 擅长的地方，非常适合拿来做这种以前的人工体力活。
