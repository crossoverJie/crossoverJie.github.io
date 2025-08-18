---
title: 用 Go 实现一个 LRU cache
date: 2021/12/20 08:11:16 
categories: 
- Go
tags: 
- LRU cache
---

![](https://s2.loli.net/2021/12/20/Q6LHFvrl81RUVAm.jpg)

# 前言

早在几年前写过关于 `LRU cache` 的文章：
[https://crossoverjie.top/2018/04/07/algorithm/LRU-cache/](https://crossoverjie.top/2018/04/07/algorithm/LRU-cache/)

当时是用 Java 实现的，最近我在完善 [ptg](https://github.com/crossoverJie/ptg) 时正好需要一个最近最少使用的数据结构来存储历史记录。

> ptg: Performance testing tool (Go), 用 Go 实现的 gRPC 客户端调试工具。

Go 官方库中并没有相关的实现，考虑到程序的简洁就不打算依赖第三方库，自己写一个；本身复杂度也不高，没有几行代码。

<!--more-->

配合这个数据结构，我便在 [ptg](https://github.com/crossoverJie/ptg) 中实现了请求历史记录的功能：

> 将每次的请求记录存储到 lru cache 中，最近使用到的历史记录排在靠前，同时也能提供相关的搜索功能；具体可见下图。

![](https://s2.loli.net/2021/12/20/Arq5pxZoF2ksnXW.gif)

# 实现

![](https://s2.loli.net/2021/12/20/1MXvgZ32WaQ8U4s.jpg)

实现原理没什么好说的，和 `Java` 的一样：

- 一个双向链表存储数据的顺序
- 一个 `map` 存储最终的数据
- 当数据达到上限时移除链表尾部数据
- 将使用到的 `Node` 移动到链表的头结点

虽然 Go 比较简洁，但好消息是基本的双向链表结构还是具备的。

![](https://s2.loli.net/2021/12/20/nEHFimku5AYOqv9.jpg)

所以基于此便定义了一个 `LruCache`:

![](https://s2.loli.net/2021/12/20/iT2ZORsy4tL5mBC.jpg)

根据之前的分析：

- `size` 存储缓存大小。
- 链表存储数据顺序。
- `map` 存储数据。
- `lock` 用于控制并发安全。

![](https://s2.loli.net/2021/12/20/zpGjK4BWcITwfA2.jpg)

接下来重点是两个函数：写入、查询。

写入时判断是否达到容量上限，达到后删除尾部数据；否则就想数据写入头部。

而获取数据时，这会将查询到的结点移动到头结点。

这些结点操作都由 List 封装好了的。
![](https://s2.loli.net/2021/12/20/xUquXg2BMoTdGFC.jpg)

所以使用起来也比较方便。

最终就是通过这个 `LruCache` 实现了上图的效果，想要了解更多细节的可以参考源码:

[https://github.com/crossoverJie/ptg/blob/main/gui/lru.go](https://github.com/crossoverJie/ptg/blob/main/gui/lru.go)


