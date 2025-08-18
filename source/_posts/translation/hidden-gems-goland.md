---
title: 【译】Goland 中的隐藏宝石
date: 2022/07/28 08:03:13       
categories: 
- 翻译
tags: 
- IDE
---


**[原文链接](https://blog.jetbrains.com/go/2022/07/21/hidden-gems-in-goland/)**


![](https://tva1.sinaimg.cn/large/e6c9d24ely1h4lrsooqqjj212w0k6t9k.jpg)


在日常使用 `Goland` 时，团队收集了一些可以帮助我们专注于创造的同时减少重复工作的小技巧。
如果你是在 `IDEA` 中使用的 `Go` 插件，或者其他 `IntelliJ` 的产品，同样也有这些特性。

<!--more-->

# 行排序

当你在查看文本文件时，行排序非常有用；按照字母排序后能够帮我们更好的阅读，同时也容易找到重复的行。

在菜单栏中使用 `Edit | Sort Lines or Edit | Reverse Lines`可以帮我们快速的对选中的代码或者是整个文件进行排序；或者也可以使用快速命令执行这个操作。

![](https://lh4.googleusercontent.com/G6g_eIinHwfZchGFPW9cBWYqYzrLuDTQYFafJZ0U0XlibbgANGVZwfgu7UM7bdN1Kr5tiPxk1ELV5F6sgQILyJKyDiziwUGqBOZxUWugfxNvZ9kw4KQBbl9zv-Z4oj8Uxru3Y12glEkhvWAqXxy0R-Q)

# 打开对比窗口

打开一个对比窗口可以帮助我们对比任何文件、文件夹、文本；举个例子，将复制的内容粘贴到对比窗口中，IDE 会类似于版本控制系统那样展示两者的差异。

当然也可以用快速指令打开对比窗口（double shift)。

![](https://lh4.googleusercontent.com/2GtGBX33TZw7WEyVgSYwYcRozVp4AYp8xNYUp4fXtjWXiwolR5ikJdf-AoROpJw1A2HKyolrLR5HAdYUYWbIgJydX01FBOlUQ54BMHh7KS9Jda1Slc0QQp_N-uGwYsBBKAr-yhtsiVWTNrSB6PpYeIA)

此外你也可以在 IDE 编辑器的任何地方右键鼠标选择与当前粘贴板数据进行对比。

> 这个功能很棒，可以替换掉以前大部分用 BeyondCompare 的场景了。

# 暂存文件

有时候你需要一个随意的地方来编写一段文本，与当前工作相关的一些记录，也或是与当前项目上下文无关的草稿代码；这时候就需要用到暂存文件了。

暂存文件可不只是简单的笔记，它支持语法高亮、代码提示以及所有和这个文件类型相关的特性。

暂存文件与当前项目无关，你可以在任意项目中访问到这些文件，这样你就不需要离开 IDE 到其他地方来保存这些文件了。

可以在菜单栏中新建暂存文件`File | New | Scratch File or`，也可以使用快捷键 `⇧ ⌘ N`.

![](https://lh4.googleusercontent.com/d-HxnmVYaZOJq8mqJzCMagroGVpg6i7E2VF2j44MhGsqluWKRXENxgZI4sy8pLNaYex6hxSD9Yg0hNM06PgKvKjifGNYYfbA21C4mCiQAN0GctH2SK2fW9DFg1boZ3G2gZyradsaGVH08clG96s1KnY)


> 通常使用这个功能来存放和运行一些测试或者是实例代码。

# 多行光标

多行光标可以让你快速在多个地方同时修改代码，同时它也支持代码提示以及实时模板。

开启多行光标可以双击 `⌥/Ctrl` 后不要释放，然后点击上下箭头键。使用 `Escape` 键可以退出多行光标。

![](https://lh3.googleusercontent.com/Zb_1_CiZAP0_6rvAKurH-LsP3OOXqUufkLeeOTWtsCj2EtHAgPZ7sJq3_39oLwwT8bL8gH1eLynMLCQoBI73pUi5STUozXcCOBFry4lGLI-XVEAQYSrQ-opyFv1S_HKt56jYwDAimcFWskDbPpp85nQ)

> 这个在批量修改代码时非常有用。

# 批量折叠和展开

在阅读复杂长篇代码的过程中有时候很难弄懂代码结构，即便是代码是我们自己写的。

这也容易解决，批量折叠和展开可以快速帮我们浏览代码，快捷键是：macOS:`⇧⌘- /⇧⌘+`,Windows/Linux: `Ctrl+Shift+NumPad + / Ctrl+Shift+NumPad`。

IDE 可以帮我们折叠/展开选中的代码，如果没有选中则是处理整个文件。

也可以使用 macOS:` ⌥⌘- / ⌥⌘+`, Windows/Linux:`Ctrl+Alt+NumPad + / Ctrl+Alt+NumPad` 来递归的处理代码，IDE 将会折叠/展开当前代码片段或者是他们包含的片段。

![](https://lh5.googleusercontent.com/cYtEgj2G98zshGwM-1a91f6_kqP1ZjLdWA_yQOCsXOo_0KQC4O9HL1Lphs-vdN71kiD_XjZ_Rh5oDo8zhuh9u7KuSacMFqfv6U1F0kXd8zJT3uF3f0GkZgu1P-OgAPGrG77ByWn5UmcK-uIdZ0Iahqo)

# 最近文件

最近文件可以帮助我们快速跳转到最近经常打开的文件，当我们使用 macOS:`⌘+E` Windows/Linux:`Ctrl + E` 打开最近文件对话框的时，再使用`⌘+E`可以再次过滤只显示已经修改过的文件，这样可以帮我们更精准的查找。

![](https://lh5.googleusercontent.com/dfCbbr1RJYJGM12VmuNf7ebgvi01W3yseLvHLELhaMSyTy_MK2N3VmgXxJqcgJ3NVlYzsX9PV3_qiUA9cy_T8_Z5HGY9FDYyn6AwT9Xk6wTieDHl89hKf0JsCeV3XNZEgPcB9TgjbM8CH4o12RyRhfQ)

这些特性可能有些并不常用，一旦用上一次解决问题后会发现 `IntelliJ` 的 `IDE` 功能非常强大，如果你还发现了一些其他有用的特性请在留言区分享。