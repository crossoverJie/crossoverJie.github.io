---
title: 读完 Bun 用 Rust 重写：1 个人 11 天重写 50 万行代码是怎么做到的
date: 2026/07/12
categories:
  - AI
tags:
  - AI
  - Claude
  - Rust
  - Bun
  - LLM
banner_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260712160208850.png
index_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260712160208850.png
---
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260712160208850.png)

前两天发了一篇 [Rewriting Bun in Rust](https://mp.weixin.qq.com/s/WbROkvwrUFw5Lkm4-bDOXw) 原文的翻译，内容有点多，这次我自己整理了一份精简版。


# 背景

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/imagesmac_1783837029900.png)


一开始是因为在 X 上刷到 Bun 官方博客一篇[《Rewriting Bun in Rust》](https://bun.com/blog/bun-in-rust)，作者是 Jarred Sumner。看完挺震撼的——1 个工程师，用 CC（Claude Code）+ Claude Fable 5（重写那会儿还是预发布，现在订阅用户已经能正常用了），11 天把整个 Bun 从 Zig 重写成 Rust，落地 diff +100 万行，6,778 个 commit。

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260710085026741.png)
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260710085654920.png)

这篇是我读完之后按自己的理解整理的笔记，分几个部分讲清楚：
为什么要扔掉 Zig、
为什么选 Rust、
整个工作流是怎么搭的、
作者和 CC 各自干了什么、
怎么保证质量，
以及烧了多少钱。

> 顺带一提：Bun 在 2025 年 12 月被 Anthropic 收购了，作者现在也在 Anthropic。这次重写用的是 Claude Fable 5，重写那会儿（2026 年 5 月）还是预发布版，到截稿今天（2026-07-12）已经对订阅用户开放了。所以这文章多少带点「自家产品自家用了」的意味，但流程本身是真有东西的。

<!--more-->

---

# 为什么要停止使用 zig

先说清楚一件事：作者没有「骂」Zig，反而一直强调没有 Zig 就没有 Bun。Bun 最初就是把 esbuild 的 JS/TS 转译器从 Go 逐行移植到 Zig 的产物，作者 2021 年写下第一行 Zig，一个人一年在奥克兰的出租屋里把 Bun 初版手搓出来。可以说 Zig 是 Bun 的恩人。

但问题出在「稳定性」上。Bun 的范围大得吓人——转译器、打包器、npm 兼容包管理、类 Jest 测试运行器、Node.js API（`fs`/`net`/`tls` 一堆）、HTTP/WebSocket 客户端，全塞在一个 runtime 里。这种规模 + Zig，结果就是一长串内存安全 bug。原文贴了一小撮，我挑几个有代表性的：

| 类型 | 场景 |
|------|------|
| heap-use-after-free | `node:zlib` 线程池里还有异步 `write()` 时，对 stream 调 `.reset()` |
| use-after-free | `node:http2` 可重入 JS 回调触发 hashmap rehash，内部流指针失效 |
| 堆越界写 | `UDPSocket.sendMany()` 迭代途中 socket 连接状态被用户回调改写 |
| 内存泄漏 | `tlsSocket.setSession()` 每次调用漏一个 `SSL_SESSION`（约 6.5KB） |
| double-free | CSS 解析器里 `background-clip` 带 vendor 前缀 + 多层背景 |
| 竞态崩溃 | `MessageEvent` 的 GC marker 线程观测到被撕裂的 variant |

根因在哪儿？JavaScript 是带 GC 的语言，JavaScriptCore（以及 V8）对异常处理和 GC 有严格规则。而 Zig 跟 C 一样不替你管内存，没有构造函数/析构函数，清理工作要靠每个调用点显式写 `defer`。

> 这不是 Zig 的锅。其他 Zig 用户没这种 bug，是因为「把 GC 值和手动管理的值混在一起」本身就是个不常见的需求，没有哪门语言会专门为此设计。

对 Bun 来说，正确处理「GC 管的值」和「手动管的值」的生命周期，一直是稳定性问题的主要来源——最常见的是小内存泄漏，偶尔直接崩。每一处内存分配都得仔细 review：这些字节在哪释放？怎么保证只释放一次？JS 异常都检查了吗？这块内存是 GC 管的还是手动管的？

作者他们也做过不少防护：给 Zig 编译器打补丁加 ASAN、每次 commit 都开着 ASAN 跑测试、用 Fuzzilli 7×24 fuzz 运行时 API、一堆端到端内存泄漏测试。这已经比大多数项目做得多了。但还是堵不住。

说白了，可以一直一个个修下去，但用户指望着你，理应做得更好——从系统层面防止这类 bug 反复出现。于是有了换语言的念头。

# 为什么切换为 rust？

候选其实有三个：继续用 style guide 硬撑 Zig、换 C++、换 Rust。

**为什么不是「继续用 Zig + style guide」？** 很多项目靠 style guide 回答这类问题，TigerBeetle 的 [TigerStyle](https://tigerstyle.dev/)（一份 Zig 的 style guide）、Google 那份 31000 字的 [C++ style guide](https://google.github.io/styleguide/cppguide.html) 都是例子。style guide 的难处不在写，在执行——你怎么保证它被遵守？历史上只能靠 code review + linter 尽力而为。作者甚至想过在 Zig 里手搓一套受 Rust 启发的智能指针，但他自己都嫌弃：自制的智能指针比 Rust 体验更差，还换不来任何保证。

**为什么不是 C++？** Bun 大约 20% 的代码本来就是 C++，还内嵌了 JavaScriptCore、uWebSockets、BoringSSL、SQLite 这些 C/C++ 库。换 C++ 是个合理选择，能拿到构造/析构函数，还能删掉一堆 `extern "C"` 包装。但内存问题上还是得靠 style guide + code review，即便有 ASAN，内存损坏和泄漏照样会发生。

**为什么是 Rust？** 看回上面那份 bug 清单，很大一部分是 use-after-free、double-free、错误路径上「忘记释放」。在 safe Rust 里，这些都是**编译错误**，外加 `Drop` 这种类 RAII 的自动清理。

> 编译错误是比 style guide 更好的反馈回路。

一句话：Rust 把「靠人记」变成「靠编译器兜底」。

但重写在历史上都是个糟糕主意。去掉注释，Bun 有 535,496 行 Zig。换语言重写要一个小团队整整干一年，期间得冻结 bugfix、安全修复和功能开发。作者选了风险最低的做法——**机械式移植**，行为改动尽量少，用已有的那套测试套件。好在 Bun 自己的测试是用 TypeScript 写的，不依赖 runtime 的实现语言，这给了重写一个「不变量」可以对照。

> 这里有个关键判断：重写的样子要像把 Zig 转译成 Rust，先不过度追求地道 Rust。等 v1.4 发出去之后，再逐步减少 `unsafe`、改成更地道的写法。一步到位太贪，容易翻车。

# 整个切换的工作流是什么？

这部分是我觉得整篇文章最值得拆开看的地方。作者没有「给 Claude 一句 prompt 然后赌它能成」，而是搭了大约 **50 个 dynamic workflow**（CC 的动态工作流），在 11 天里持续跑。

工程师日常大量工作可以简化成一个循环：

```js
// 伪代码
let task;
while ((task = todoList.pop())) {
  const result = task();
  const feedback = await Promise.all([review(result), review(result)]);
  await apply(feedback, result);
}
```

每个 workflow 都是这样的一个循环，分别干：生成移植指南、逐文件移植 `.zig`→`.rs`、修编译错误、修子命令、修测试、大重构。整体节奏大致是这样：

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260710085122626.png)

| 阶段    | 干什么                                                                                                               |
| ----- | ----------------------------------------------------------------------------------------------------------------- |
| Prep  | 花 3 小时和 Claude 讨论模式映射，产出 `PORTING.md`（后来还上了 HN）；再跑一个 workflow 分析每个 struct 字段的生命周期，产出 `LIFETIMES.tsv`，并经对抗式 review |
| 试运行   | 先只移植 3 个文件，验证流程                                                                                                   |
| 写代码   | 峰值每分钟约 1,300 行，6,502 个 commit                                                                                     |
| 修编译错误 | 约 16,000 个错误，按 crate 分给 64 个 Claude                                                                               |
| 跑通    | `bun --version` → `bun test <file>` → 全测试                                                                         |
| CI 全绿 | 972 个失败测试文件 → 2 天后 23 个 → 最终 6/6 平台全绿                                                                             |
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260710085408902.png)

中间踩了一堆坑，作者原话叫「false starts」：

- Claude 们互相踩脚：一个跑 `git stash`，另一个跑 `git stash pop`，还有 `git reset --hard`。问题在于这几个命令都是对**整个工作区 / index / stash 栈**的全局性破坏操作，而一开始多个 Claude 共用同一份工作区。`git stash` 会把别人半成品的改动一起搁走，`git stash pop` 可能恢复出不相关的改动，`git reset --hard` 更狠——一个 agent 跑一下，仓库里所有其他 agent 没提交的活瞬间清零。结果就是丢活、冲突、状态错乱，agent 们互相把对方的工作撤销掉。下规则：只允许「针对特定文件的原子提交」（`git add <具体文件> && git commit`），禁止任何会全局改动工作区/index 的命令（`git stash`/`reset --hard`/`checkout .` 这类）。光禁还不够，后来又拆成 4 个独立 worktree 物理隔离，才真正解决。
- 太慢 → 拆成 4 个 worktree 分片，每个跑 16 个 Claude，峰值同时 64 个 Claude。
- Claude 把「让所有 crate 编译通过」理解成「用 stub 把报错函数糊过去」，还写长注释自圆其说。加规则：**需要一整段注释论证 workaround 为什么没问题，代码就是错的——去修代码。**
- 压测会把机器 TCP socket 耗尽、写几个 GB 到磁盘、spawn 上万个进程，debug 构建超时。用 `systemd-run`（cgroups）限制内存/CPU、隔离 pid 命名空间。机器还是几次跑光磁盘崩了。

## 作者担任的角色是什么？CC 担任的角色又是什么？如何搭配工作的？

这是我看这篇文章最想搞清楚的问题。结论是：**作者不是只做 review 的人，他是架构师 + 流程设计者 + 监工 + 验收者；CC 是执行者（写代码 + 互相 review + 改代码）。**

**作者干的：**

- **战略决策**：选一次性全量重写而非增量、选机械式移植、定下「先像转译、之后再改地道」的总方针。这些 CC 不会替你拍板。
- **流程/workflow 设计**：50 个 dynamic workflow 的循环结构是他搭的，每个 workflow 跑什么也是他定的。
- **prompt 与规范制定**：产出 `PORTING.md`、`LIFETIMES.tsv`，自己人工通读。
- **监工 11 天**：原文——「most of those 11 days, I monitored workflows, manually reading the outputs to check for issues and bugs, and prompting Claude to edit the loop to fix things」。也就是人工读输出、发现问题、改 workflow 的 prompt 让 Claude 自己修。
- **处理翻车 + 改规则**：上面那些 false starts 的规则都是他下的。
- **验收**：合并前人工核实测试「确实在跑、没被跳过」，本地跑一堆命令试，然后才按合并键。还把 Zig 和 Rust 并排人工通读了大量代码。

**CC 干的：**

- 实际写代码（峰值每分钟约 1,300 行，落地 diff +1,009,272）。
- 修编译错误（约 16,000 个）。
- 修测试失败（本地 + CI 各平台）。
- **对抗式 review**——注意，reviewer 也是 Claude，独立上下文窗口，1 个实现者配 2 个对抗式 reviewer。所以连 review 都大量是 **Claude 审 Claude**。

两人怎么搭配？核心是一句话：**当出问题时，修掉生成代码的流程，而不是手工修代码。** 作者修的是「过程」，具体代码交给 CC。

> 这种分工其实挺反直觉的。很多人用 Agent 是「让 Agent 写，我审」。作者反过来：让 Agent 写、Agent 审、Agent 改，自己只盯「流程」和「验收」。把人从执行链路里摘出来，专心做架构和决策。这个思路我个人觉得是这次重写最值得安利的部分。

对抗式 review 还有个设计细节很巧：**拆分上下文窗口**。写代码的 Claude 想让代码被接受（有「赶紧发出去」的偏向），审代码的 Claude 被要求「假定代码是错的，找它不工作的理由」。reviewer 只拿到 diff，看不到实现者的任何推理。1 个实现者 + 2 个以上对抗式 reviewer，实现者不审、reviewer 不写。原文举了一个真抓到的 bug：异步 `uv_close` 之前 Box 就 drop 了，先 UAF 再 double-free，编译能过、看着也没问题，但 reviewer 抓到了。

# 如何保证切换后的代码质量，如何做测试？

一个 +100 万行的 PR 怎么 review？你怎么建立信心去合并？作者给的答案是三件套：

1. **一套与语言无关、含上百万断言的测试**。
2. **对抗式 code review**。
3. **出问题时，修流程而不是手修代码**。

测试这块是真扎实。测试用 TypeScript 写，所以不依赖 runtime 语言，重写前后用的是同一套。各平台的断言数：

| 平台 | expect() 调用数 | 测试数 | 文件数 |
|------|------|------|------|
| Debian 13 x64 | 1,386,826 | 60,624 | 4,174 |
| macOS 14 arm64 | 1,259,953 | 58,850 | 4,175 |
| Windows 2019 x64 | 1,007,544 | 57,337 | 4,173 |

合并前要求 **100% 测试在所有平台的 CI 上都通过**，作者还人工核实测试「确实在跑、没被跳过」——这一步很重要，Agent 偷懒跳测试是经典坑。

合并之后还在持续加码：

- **11 轮安全审查**（Claude Code Security），处理了所有发现。
- **7×24 覆盖引导 fuzzing**，覆盖每个解析器——JS、TS、JSX、CSS、JSON5、JSONC、TOML、YAML、Markdown、INI、Bun Shell、semver、.patch、CSS 颜色。fuzzer 找到 bug 自动发给 Claude 提 PR 复现+修复，人审。迄今跑了 1000 亿次，产出约 15 个 PR。
- **Miri**（在 CI 里覆盖越来越大的代码段）+ **LeakSanitizer**。
- `unsafe` 占比：约 4% 的 Rust 代码在 `unsafe` 块里（~13,000 个 `unsafe` 关键字 / ~780,000 行），其中 78% 只有一行——基本是一个来自 C++ 的指针或一次对 C 库的调用。

当然，重写不可能零回归，这次引入了 **19 个已知回归，全部已修**。多数来自「两门语言语法相同、语义不同」的坑，原文举的例子很值得记一下：

- **`debug_assert!` 里的副作用**：Zig 的 `assert` 是函数，参数每次都跑；Rust 的 `debug_assert!` 是宏，release 构建里整段被抹掉，连里面的 `insert_stale` 调用也没了，HMR 在某些场景挂了。debug 构建正常，所以一开始没发现。
- **奇数长度切片**：Zig 的 `reinterpretSlice` 用 `@divTrunc` 忽略尾部奇数字节，`bytemuck::cast_slice` 直接 panic。
- **边界检查**：Zig 的 `ReleaseFast` 去掉边界检查，Rust release 保留，于是原本不可达的越一 bug 被触发，Rust panic 而不是写越界。
- **`comptime` 格式串**：Zig 里 `fmt` 是 comptime，颜色标记在参数替换前就处理掉了；Rust 函数没有 comptime 参数，标记被改写到了参数上。

> 这些坑本质上都是「机械移植」的代价。语法看着一样，语义不一样，最容易懵逼。但也正因为有那套百万断言的测试兜底，才敢这么干。

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260710090147962.png)
效果上，Rust 版的 Bun 确实更好了：内存占用下降（修掉了每个可插桩的内存泄漏，`Bun.build()` 从每次泄漏约 3MB 变成趋于平稳）、二进制体积缩小约 20%（Linux/Windows）、性能快 2%–5%。

# 整体使用的模型、token、花费大约是多少？

| 项目            | 数值                                          |
| ------------- | ------------------------------------------- |
| 模型            | Claude Fable 5（Mythos 级别；重写时为预发布，现已对订阅用户开放） |
| 未缓存输入 token   | 59 亿                                        |
| 输出 token      | 6.9 亿                                       |
| 缓存输入 token 读取 | 720 亿                                       |
| API 花费        | 约 165,000 美元                                |
| 峰值并发          | 64 个 Claude（4 个 workflow × 16）              |
| 耗时            | 11 天（5 月 3 日 → 5 月 14 日合并）                  |
| commit 数      | 6,778 个                                     |

**没有 LLM 的时代要多少人干多久？** 作者自己的估算：3 个对代码库有完整 context 的工程师，干一年。而且这一年里没法改进 Node.js 兼容性、没法修 bug、没法修安全问题、没法加新功能。作者原话——「我们绝不会这么做」。现实的替代方案就是「什么都不做，一直修文章开头那些 bug」。

说白了，这次重写之所以能成，不是因为 Rust 比 Zig 好多少，而是因为 LLM 把「重写一年、冻结所有业务」这个成本，压到了「1 个人 11 天 + 16 万刀」。

> 16 万刀看着贵，但对比「3 个核心工程师一年全力投入、期间零业务推进」的机会成本，这笔账其实算得过。而且 Fable 5 现在已经对订阅用户开放，重度 CC 用户用订阅额度也能跑起来，这套流程会越来越香。

# 总结

读完这篇，我最大的感受不是「Rust 真好」或者「Zig 不行」，而是「**一个工程师今天能做的，比前些年多得多**」。

这是一些我总结的经验：

1. **人从执行链路里摘出来**。让 Agent 写、Agent 审、Agent 改，人只盯「流程设计」和「验收」。这跟很多人用 Agent「让它写、我来审」的直觉是反的，但作者用 11 天 + 100 万行证明了这条路可行。
2. **修流程，不修代码**。出问题改 workflow 的 prompt 和规则，而不是手修 diff。这是把「一次性修补」变成「系统性防止」的关键。
3. **对抗式 review + 拆分上下文窗口**。实现者想合并、reviewer 想找茬，天然对立；reviewer 只拿 diff、看不到实现者推理。这套设计可以直接抄到自己的 CC workflow 里。
4. **语言无关的测试套件是重写的底气**。敢机械移植，前提是有一套百万断言、跟实现语言无关的测试兜底。没有这个，谁也不敢合并 +100 万行 LLM 代码。
5. **机械移植 > 一步到位**。先像转译、行为不变，之后再改地道。一步到位太贪，容易翻车。这个判断对任何「大重构」都适用。

当然也有它的特殊性：作者是 Bun 的创造者、对代码库有完整 context，重写那会儿用的还是 Fable 5 预发布版（现在已开放订阅），流程本身也踩了不少坑（互相踩脚、stub 糊编译错误、磁盘跑光）。不是随便谁来都能复刻。但方法论是通用的——**流程设计 + 对抗式 review + 强测试兜底 + LLM 执行**，这套组合拳，值得每个重度用 CC 的人认真琢磨。

不过说回国内，16 万刀换算过来是一笔不小的开支。最近还有个趋势挺值得警惕：一些老板看到别家公司对外宣传的「Agent 重写」「AI 替代工程师」成果，就也想在内部搞一套，想着用 Agent 替掉几个工程师来省钱。

但在我看来，这事没这么简单，至少得先想清楚几个问题：

1. **业务真的需要顶配模型吗？** 大部分业务说白了就是增删改查，拿最贵的模型去跑这种活，杀鸡用牛刀（简单来说都是增删改查）。
2. **舍得花这么多钱吗？** 16 万刀只是一次重写的 API 费，常态化跑起来账单只会更吓人，这笔账得先算清楚。
3. **指挥 AI 干活的人，能不能扛起来？** 这次能成的前提是作者本身就是 Bun 的创造者，对代码库有完整 context，能当好架构师 + 流程设计者 + 监工 + 验收者这几个角色。换成公司里一个对业务没那么熟的工程师来指挥，效果天差地别。
4. **内部怎么评估 AI 带来的效率提升？** 没有量化就只有感觉，而「我感觉快了」这种话，最后往往经不起对账。

很多老板自己都没想清楚，就被对外宣传裹挟着陷入深深的焦虑，一头扎进去搞 AI 替代，最终的效果往往适得其反——钱花了，人也没省下来，业务还可能被带歪。

> 让子弹飞一会，但这次子弹已经飞到 100 万行代码量级了。
