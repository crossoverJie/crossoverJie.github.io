---
title: 从 JetBrains 的亏损聊起
date: 2026/10/13 16:20:05
categories:
  - AI
tags:
  - AI
banner_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20261012181335536.png
index_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20261012181335536.png
---
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20261012161810222.png)

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20261012171821714.png)

前两天看到新闻：JetBrains 2025年净亏损3.15亿克朗：有记录以来首次亏损。

以前很难想象这个在开发者心中顶级公司居然会出现亏损，只是这几年的存在感确实是下降严重。

我记得大概是在 16 年我工作一年之后接触到 JetBrains，当时用惯了 Eclipse，所有的项目都在一个窗口里进行管理，而 JetBrains 的是每个项目一个窗口，导致当时还适应了一段时间。

之后就被他的调试器、速度、快捷键、UI 这些吸引彻底放弃了 eclipse，这一晃用了小十年了，只是从去年底开始就几乎很少打开了。

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20261012171726119.png)

现在纯粹就是一个 git gui 工具，不过一些轻量场景也会直接在终端用 [lazygit](https://github.com/jesseduffield/lazygit) 替代了，效果也是类似的。

我在上一篇文章 [我的 Agent 工作流：终端折腾了一圈，又回到了 Warp](https://crossoverjie.top/2026/09/23/AI/agent-workflow/) 里提到平时主要使用 Warp 进行开发，一些轻量的编辑任务直接就在终端里完成了。

即便是 JetBrains 家最强的 debug 功能，现在也可以交给 Agent 使用日志大法调试完成；无非就是多耗一点 token，效率比自己各种打断点、条件断点高很多。

> 以前为了可以高效使用 IDEA 这些产品还需要去学习它的快捷键，各种最佳实践。

最近也用 [zed](https://zed.dev/) 替代了 vscode，偶尔需要查看大文件的时候就使用 zed 打开，也非常丝滑。

在上次文章的评论区里有人提到了 [Paseo](https://github.com/getpaseo/paseo/),用了几天发现非常合我胃口，现在用它来做 Agent 管理，纯终端的功能还是交给 Warp。

打败你的往往不是和你做同一类型的产品，而是另一个维度的魔法，比如诺基亚被 iPhone 打败；短信被即时通讯 app 替代等。

JetBrains 在几年前肯定想不到人们今后都不用 IDE 写代码了，从以前的 talk is cheap show me the code，转变为 code is cheap show me the talk.

# 原研药 VS 仿制药

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20261012173702773.png)


最近 GitHub 上还有一个项目火了：[rea](https://github.com/morluto/rea)

他的作用是使用 Agent 来逆向任何 app，比如 Office、CAD 等安装到你电脑上的软件。

通过 app 的功能、底层的二进制、元数据文件，调用一些反编译工具来逆向软件，我在一个评论区看到一个说法，这就是原研药和仿制药的区别😂。

这个看起来很美好，其实和你熟悉一个 app 功能，然后重新自己写 PRD 文档让 Agent 来实现本质上没有区别，只是它省去了解析 PRD 文档这个步骤，而是通过反编译来获取这份功能清单。

同时这种逆向也会消费大量的 token，按目前的成本来看，可能你少了几千块的 token 都够买断这个软件了，而且要承担使用的不稳定性。

同时这对软件版权也是一个威胁，既然大家都可以逆向，那还有企业愿意做创新吗？

就像刚才提到的，打败你的肯定不是类似的产品，模仿的再像也只是用户的备选方案之一。

只是我们研发人员确实要考虑下如果只是产品的翻译机器，那就和这个 rea 没啥区别了。
