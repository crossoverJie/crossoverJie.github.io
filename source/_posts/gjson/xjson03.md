---
title: XJSON 是如何实现四则运算的？
date: 2022/07/12 08:12:36 
categories: 
- xjson
- compiler
tags: 
- go
---

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h42y3ylnbuj20wi0lomz7.jpg)
# 前言

在[上一篇](https://crossoverjie.top/2022/07/04/gjson/gjson02/)中介绍了 `xjson` 的功能特性以及使用查询语法快速方便的获取 `JSON` 中的值。

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h42btsa4cgj21cs0mmjuh.jpg)

同时这次也更新了一个版本，主要是两个升级：

1. 对转义字符的支持。
2. 性能优化，大约提升了30%⬆️。

<!--more-->
## 转义字符

先说第一个转义字符，不管是原始 `JSON` 字符串中存在转义字符，还是查询语法中存在转义字符都已经支持，具体用法如下：

```go
	str = `{"1a.b.[]":"b"}`
	get = Get(str, "1a\\.b\\.\\[\\]")
	assert.Equal(t, get.String(), "b")

	str = `{".":"b"}`
	get = Get(str, "\\.")
	assert.Equal(t, get.String(), "b")

	str = `{"a":"{\"a\":\"123\"}"}`
	get = Get(str, "a")
	fmt.Println(get)
	assert.Equal(t, get.String(), "{\"a\":\"123\"}")
	assert.Equal(t, Get(get.String(), "a").String(), "123")

	str = `{"a":"{\"a\":[1,2]}"}`
	get = Get(str, "a")
	fmt.Println(get)
	assert.Equal(t, get.String(), "{\"a\":[1,2]}")
	assert.Equal(t, Get(get.String(), "a[0]").Int(), 1)
```

## 性能优化
性能也有部分优化，大约比上一版本提升了 30%。

```go
pkg: github.com/crossoverJie/xjson/benckmark
cpu: Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz
BenchmarkDecode-12        	   14968	     77130 ns/op	   44959 B/op	    1546 allocs/op
PASS

------------------------------------
pkg: github.com/crossoverJie/xjson/benckmark
cpu: Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz
BenchmarkDecode-12        	   19136	     62960 ns/op	   41593 B/op	    1407 allocs/op
PASS
```

但总体来说还有不少优化空间，主要是上限毕竟低，和官方库比还是有不小的差距。

# 实现四则运算

接下来聊聊四则运算是如何实现的，这本身算是一个比较有意思的 `feature`，虽然用的场景不多🙂。

先来看看是如何使用的：

```go
	json :=`{"alice":{"age":10},"bob":{"age":20},"tom":{"age":20}}`
	query := "(alice.age+bob.age) * tom.age"
	arithmetic := GetWithArithmetic(json, query)
	assert.Equal(t, arithmetic.Int(), 600)
```
输入一个 `JSON` 字符串以及计算公式然后得到计算结果。

其实实现原理也比较简单，总共分为是三步:
1. 对 `json` 进行词法分析，得到一个四则运算的第一步 `token`。
2. 基于该 `token` 流，生产出最终的四则运算表达式，比如 `(3+2)*5`
3. 调用四则运算处理器，拿到最终结果。

---
先看第一步，根据 `(alice.age+bob.age) * tom.age` 解析出 `token`：
![](https://tva1.sinaimg.cn/large/e6c9d24ely1h43ekglsqej21g6078jsl.jpg)

第二步，解析该 token，碰到 `Identifier` 类型时，将其解析为具体的数据。
![](https://tva1.sinaimg.cn/large/e6c9d24ely1h43em2y8q3j21ha0l2tcj.jpg)
而其他类型的 token 直接拼接字符串即可，最终生成表达式：`(10+20)*20`

> 这一步的核心功能是由 `xjson.Get(json, query)` 函数提供的。

关键代码如下图所示：
![](https://tva1.sinaimg.cn/large/e6c9d24ely1h43epvk5t8j20u00v20ws.jpg)

最终的目的就是能够生成一个表达式，只要拿到这个四则运算表达式便能得到最终计算结果。

而最终的计算逻辑其实也挺简单，构建一个 AST 树，然后深度遍历递归求解即可，如下图所示：
![](https://tva1.sinaimg.cn/large/e6c9d24ely1h43eugwrduj20n80n4mxz.jpg)

> 这一步的核心功能是有之前实现的脚本解释器 [gscipt](https://github.com/crossoverJie/gscript/blob/4897b0dd0e4110820c1e69f7a692d90640325cbd/syntax/parse.go#L10) 提供的。

感兴趣的朋友可以查看源码。

# 总结

一个 `JSON` 库的功能其实并不多，欢迎大家分享平时用 `JSON` 库的常用功能；也欢迎大家体验下这个库。

源码地址：
[https://github.com/crossoverJie/xjson](https://github.com/crossoverJie/xjson)