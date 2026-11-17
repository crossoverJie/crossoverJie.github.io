---
title: 装了一年 SKILLS，我用 SkillDeck 做了次体检
date: 2026/11/17 23:00:00
categories:
  - AI
tags:
  - AI
  - Skills
  - Claude
  - macOS
  - SwiftUI
banner_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20261117155222981.png
index_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20261117155222981.png
---
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20261116175455528.png)



距离 SKILLS 发布已经快有一年的时间了，记得刚发布那时候我和其他人一样都觉得这真是一个天才般的产品设计，让个人或公司可以将自己的某个业务打包成一个 SKILLS 供其他人调用。

甚至后面随着各大科技公司的裁员进行，离职的提炼自己的 SKILLS 也上过一段时间热搜，甚至还有调侃：离职的同事没有消失，只是住进了服务器里。


当时装了很多 SKILLS 有用没用的都是一股脑的安装，比如出名的 superpower，ponytail，grill-me 等等。

可是用了一段时间之后也没发现效果有多好，这其中我总结有以下几个原因：

### SKILLS 太多，对 AI 造成的干扰太大。

我们都知道 SKILLS 的触发原理，每次和 LLM 的对话都会带上所有的 SKILL 的描述内容，让 LLM 根据对话的上下文选择使用哪个 skill，这个步骤对我们用户来说是黑盒，是否能选中你想要的那个 SKILLS 全靠 LLM 说了算。

而我们的 SKILLS 越多，SKILLS describe 里塞的内容也就越多，特别是一些功能类似的 SKILLS ，比如都是做 UI 设计的，都是做 Java 语法的，反而增大了大模型选中 SKILLS 的难度，有可能这次选择的是 A 进行触发，第二次选择了 B 触发，而两个 SKILLS 的具体操作步骤又不相同，从而导致实际做事的质量下降。


### 大模型能力越来越强，逐渐替代了一些常见的 SKILLS

再 SKILLS 这个概念被 anthropic 提出的时候模型能力确实没那么强，或者说训练的语料也没有那么全。

当时也流行一种说法：我们将自己的擅长的领域打包成 SKILLS 之后本质上就是让大模型学习我们的技能从而将我们替代掉。

AI 发展到现在，确实已经吸收了很多优秀的 SKILLS 了，直接将这些 SKILLS 都训练到模型本身了。

也就是说对于一些常见的需求可能都不需要 SKILLS，比如一个标准的前端设计，iOS app 设计等。

如果我们还带上这些 SKILLS 可能也会造成和刚才提到的问题类似，对上下文造成污染。



直到有一天我 之前做的 [SkillDeck](https://github.com/crossoverJie/SkillDeck)(一个对本地 SKILLS 进行增删改查的小工具) 收到了一个 [PR](https://github.com/crossoverJie/SkillDeck/pull/61)：
![[Pasted image 20261116230159.png]]

可以统计 codex 的对不同 SKILLS 的使用情况，收到这个启发之后我将其余的 Agent 也加上了这样的统计。

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20261116175455528.png)


这样在 SkillDeck 的首页就可以看到哪些 SKILLS 经常被使用，同时哪些 SKILLS 安装之后一次都没有调用过，这样的 SKILLS 是否可以考虑直接删除了。


### 其他更新

除此之外 SkillDeck 还更新几个新功能：

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20261117095023266.png)

可以将某一个 SKILLS 针对所有的 Agent 全局开关，方便我们测试 skill 的能力是否符合要求。

#### 一键批量更新 SKILLS
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20261117145417652.png)
我们的 Agent 通常不会检测 SKILLS 是否有更新，SKILLS 较多的时候一个个查看也比较费劲，虽然可以手动通过 Agent 批量更新所有的 SKILLS，现在集成到一个可视化入口里会更加方便。

项目开源，MIT 协议，欢迎 star/issue/PR：[GitHub](https://github.com/crossoverJie/SkillDeck) | [项目主页](https://crossoverjie.top/SkillDeck/)

安装方式：

```bash
brew tap crossoverJie/skilldeck && brew install --cask skilldeck
```



