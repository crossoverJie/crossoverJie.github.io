---
title: 不要小看小小的 emoji 表情😂
date: 2019/09/10 08:13:00
categories: 
- cs
tags: 
- emoji
- unicode
- utf-8
- ascii
---

![](https://i.loli.net/2019/09/10/GDoscUdhbC4k3AL.jpg)



# 前言

好久没更新了，最近事比较多，或许下个月就会恢复到正常的发文频次。

这篇文章得从一个 `emoji` 表情开始，我之前开源的一个 `IM` 项目中有朋友提到希望可以支持 `emoji` 表情传输。

[https://github.com/crossoverJie/cim/issues/12](https://github.com/crossoverJie/cim/issues/12)

![](https://i.loli.net/2019/09/10/jwW5rIiUQdLMnkB.jpg)

正好那段时间有空，加上这功能看着也比较简单准备把它实现了。

<!--more-->

但在真正实现时却发现没那么简单。

![](https://i.loli.net/2019/09/10/dTJSxgEQlAwuKeR.jpg)

---


我首先尝试将一个 `emoji` 表情存入数据库看看：

![](https://i.loli.net/2019/09/10/eyEfVD8SKiH23Uu.jpg)

果不其然的出错了，导致这个异常的原因是目前数据库所支持的编码中并不能存放 `emoji`，那 `emoji` 表情到底是个什么东西呢。

本质上来说计算机所存储的信息都是二进制 `01`，`emoji` 也不例外，只要存储和读取（编解码）的方式一致那就可以准确的展示这个信息。

> 更多编解码的内容后文再介绍，这里先想想如何快速解决问题。


# 存储 emoji

虽说想要在 `MySQL` 中存储 `emoji` 的方式也有好几种，比如可以升级存储字符集到可以存放 `emoji` ，但这种需要 `MySQL` 的版本支持。

所以更保险的方式还是在应用层解决，比如我们是否可以将 emoji 当做字符串存储，只是显示的时候要格式化为一个 emoji 表情，这样对于所有的数据库版本都可兼容。


于是我们这里的需求是一个 `emoji` 表情转换为字符串，同时还得将这个字符串转换为 emoji。

为此我在 `GitHub` 上找到了一个库，它可以方便的将一个 `emoji` 转换为字符串的别名，同时也支持将这个别名转换为 `emoji`。

[https://github.com/vdurmont/emoji-java](https://github.com/vdurmont/emoji-java)

```java
    @Test
    public void emoji() throws Exception{
        String str = "An :grinning:awesome :smiley:string &#128516;with a few :wink:emojis!";
        String result = EmojiParser.parseToUnicode(str);
        System.out.println(result);

        result = EmojiParser.parseToAliases(str);
        System.out.println(result);

    }
```

![](https://i.loli.net/2019/09/10/Xr6EwodnJepOqKT.jpg)

所以基于这个基础库最终实现了表情功能。

![](https://i.loli.net/2019/09/10/V4LGmUtx7k1Suvj.jpg)

其实它本质上是自己维护了一个 emoji 的别名及它的 Unicode 编码(本质上是 `UTF-16`)的映射关系，再每次格式化数据的时候都会从这个表中进行翻译。

![](https://i.loli.net/2019/09/10/FLs7w8NXfzbYKgH.jpg)


# 编码知识回顾

自此需求是完成了，但还有几个问题待解决。

- `Java` 中是如何存储 `emoji` 的？
- `emoji` 是如何进行编码的？


## ASCII

在谈 `emoji` 之前非常有必要了解下计算机编码鼻祖的 ASCII 码。

大家现在都知道在计算机内部存储数据本质上都是二进制的 0/1，对于一个字节来说有 8 位；每一位可以表示两种状态，也就是 0 或 1，这样排列组合下来，一个字节就可以表示 256(2∧8) 种不同的状态。

![](https://i.loli.net/2019/09/10/APbq73R4mWMI9Tj.jpg)

----

对于美国来说他们日常使用的英语只需要 26 个英文字母，再加上一些标点符号就足够用计算机来进行信息交流。

于是上个世纪 60年代定义了一套二进制与英文字符的映射关系，可以表明 128 个不同的英文字符，也就是现在的 `ASCII` 码。

这样我们就可以使用一个字节来表示现代英文，看起来非常不错。

## Unicode

随着计算机的发展，逐渐在欧洲、亚洲地区流行；再利用这套 `ASCII` 码进行信息交流显然是不行的，很多地区压根就不使用英文，而且也远超了 128 位字符（中文就更不用说了）。

虽说一个字节在 `ASCII` 码中只用了 `128` 位，但剩下(`258-128`)的依然不足用用于描述其他语言。

这时如果能有一种包含了世界上所有的文字的字符集，每一个地区的文字都在这个字符集中有唯一的二进制表示，这样便不会出现乱码问题了。

`Unicode` 就是来做这个的，截止目前 `Unicode` 已经收录了 10W+ 的字符，你所能使用的字符都包含进去了。

## UTF-8

`Unicode` 虽说包含了几乎所有的文字，但在我们日常使用好像很少看到他的身影，我们用的更多的还是 `UTF-8` 这样的编码规则。

这也有几方面的原因，比如说除开英文，其他大部分的文字都需要用 2 个甚至更多的字节来表示；如果统一都用 Unicode 来表示，那必然需要以占用字节最多的字符长度为标准。


比如汉字需要 2 个字节来表示，而英文只需要一个字节；这时就得规定 2 个字节表示一个字符，不然汉字就没法表示了。

但这样也会带来一个问题：用两个字节表示英文会使得第一个字节完全是浪费的，如果一段信息全是英文那对内存的浪费是巨大的。

---

这时大家应该都能想到，我们需要一个可变的长度的字符编码规则，当是英文时我们就用一个字节表示，甚至可以完全兼容 ASCII 码。

UTF-8 便是实现这个需求的，它利用两种规则可以表示一个字节以及多字节的字符。

![](https://i.loli.net/2019/09/10/DFOgGqsnAH2h56b.jpg)

大致规则如下：

- 当第一个字节的第一位为 0 时便表示为单字节字符，此时和 ASCII 码一致，完全兼容。
- 当第一个字节为 1 时，有几个 1 便代表是几个字节 Unicode 字符。


这样便可根据字符的长度最大程度的节省存储空间。

当然还有其他的编码规则，比如 `UTF-16`、`UTF-32`，平时用的不多，但本质上都和 `UTF-8` 一样，都是 `Unicode` 的不同实现，也是用于表示世界上大部分文字的字符集。


# Java 中的 emoji

现在来回到本次的主题，`emoji`。

刚才说到 `Unicode` 包含了世界上大部分的字符，`emoji` 自然也不例外。

![](https://i.loli.net/2019/09/10/Aeo5tuh8HGsNijp.jpg)

[https://apps.timwhitlock.info/emoji/tables/unicode](https://apps.timwhitlock.info/emoji/tables/unicode)

这个表格中包含了所有的 `emoji` 以及它所对应的 `Unicode` 编码，同时也有对应的 `UTF-8` 编码的实现。

从图中也可以看出 `emoji` 表情用 `UTF-8` 表示时会占用 4 个字节，那在 Java 中它会是怎么存储的呢？

很简单，debug 一下就知道了。

![](https://i.loli.net/2019/09/10/CHZ3UjuQOmqAklY.jpg)


在 `Java` 中也是通过 `char` 来存储 `emoji` 的，`char` 作为基本数据类型会占用 2 个字节；从刚才的图中可以看出，`emoji` 使用 `UTF-8` 会占用四个字节，这样很明显 `char` 是没法存储的，所以在这里其实是使用 `UTF-16` 编码进行存储。

基于这个原理，我们也可以自己实现将一个 `emoji` 表情转换为字符串，同时也可通过字符串转换为 `emoji`。

![](https://i.loli.net/2019/09/10/LwHmaYAy4Fx9kZD.jpg)

# 总结

从这次研究 `emoji` 可以看出，任何一门基础知识都是应用的根基，在计算机行业尤为突出，希望大家看完这篇能回忆起大学课堂被老师支配的恐惧😂。

随便提一下，相关源码可在这里查看：

[https://github.com/crossoverJie/cim](https://github.com/crossoverJie/cim)


**你的点赞与分享是对我最大的支持**
