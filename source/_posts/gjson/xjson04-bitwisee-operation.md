---
title: 用位运算为你的程序加速
date: 2022/08/01 08:14:36 
categories: 
- xjson
- compiler
tags: 
- go
- Bitwise operation
---

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h4p37zeb9aj20xc0go0tv.jpg)

# 前言

最近在持续优化之前编写的 `JSON` 解析库 [xjson](https://github.com/crossoverJie/xjson)，主要是两个方面的优化。

第一个是支持将一个 `JSONObject` 对象输出为 `JSON` 字符串。

这点在上个版本中只是利用自带的 `Print` 函数打印数据：

```go
func TestJson4(t *testing.T)  {
	str := `{"people":{"name":{"first":"bob"}}}`
	first := xjson.Get(str, "people.name.first")
	assert.Equal(t, first.String(), "bob")
	get := xjson.Get(str, "people")
	fmt.Println(get.String())
	//assert.Equal(t, get.String(),`{"name":{"first":"bob"}}`)
}
```

Output:
```shell
map[name:map[first:bob]]
```

<!--more-->

本次优化之后便能直接输出 JSON 字符串了：

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h4p3ihijjgj20ne05s0sw.jpg)

实现过程也很简单，只需要递归遍历 object 中的数据，然后拼接字符串即可，核心代码如下：

```go
func (r Result) String() string {
	switch r.Token {
	case String:
		return fmt.Sprint(r.object)
	case Bool:
		return fmt.Sprint(r.object)
	case Number:
		i, _ := strconv.Atoi(fmt.Sprint(r.object))
		return fmt.Sprintf("%d", i)
	case Float:
		i, _ := strconv.ParseFloat(fmt.Sprint(r.object), 64)
		return fmt.Sprintf("%f", i)
	case JSONObject:
		return object2JSONString(r.object)
	case ArrayObject:
		return object2JSONString(r.Array())
	default:
		return ""
	}
}
```

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h4q0yqg8u1j20u00zl0vy.jpg)


# 用位运算优化

第二个优化主要是提高了性能，查询一个复杂 JSON 数据的时候性能提高了大约 ⏫16%.

```shell
# 优化前
BenchmarkDecode-12         90013             66905 ns/op           42512 B/op       1446 allocs/op

# 优化后
BenchmarkDecode-12        104746             59766 ns/op           37749 B/op       1141 allocs/op
```


这里截取了一些重点改动的部分：

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h4q29pojhdj223g0u0gsv.jpg)

在 JSON 解析过程中会有一个有限状态机状态迁移的过程，而迁移的时候可能会出现多个状态。

比如当前解析到的 token 值为 `{`，那它接下来的 token 可能会为 `ObjectKey:"name"`,也可能会是 `BeginObject:{`,当然也可能会是 `EndObject:}`，
所以在优化之前我是将状态全部存放在一个集合中的，在解析过程中如果发现状态不满足预期的列表时则会抛出语法异常的错误。

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h4q2ysk89kj22s409omyd.jpg)

所以优化之前是遍历这个集合来进行判断的，这样的时间复杂度为 `O(N)`,但当我们换成位运算就不一样了，时间复杂度直接就变为`O(1)`了，同时还节省了一个切片的存储空间。

我们简单来分析下这个位运算为什么会达到判断一个数据是否在一个集合中同样的效果。

首先以这两个状态为例：

```go
	StatusObjectKey   status = 0x0002
	StatusColon       status = 0x0004
```

他们分别对应的二进制数据为：

```go
	StatusObjectKey   status = 0x0002 //0010
	StatusColon       status = 0x0004 //0100
```

当我们对这两个数据求 `|` 运算得到的数据是 `0110`：

```go
A:0010
B:0100

C:0110
```

这时候如何我们如果用这两个原始数据与 `C:0110` 做 `&` 运算时就会还原为刚才的两个数据。

```go
// input:
A:0010
C:0110

// output:
A:0010

----------
// input:
B:0100
C:0110

// output:
B:0100
```


但我们换一个 D 与 C 求 `&` 时：

```go
D: 1000 // 0x0008 对应的二进制为 1000
C: 0110
D':0000
```
将会得到一个 0 值，只要得出的数据大于 0 我们就能判断一个数据是否在给定的集合中了。

> 当然这里有一个前提条件就是，我们输入的数据高位永远都是是 1 才行，也就是2的幂。

同样的优化在解析查询语法时也有使用：

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h4q45v8q2dj22va0msaf2.jpg)

# 其他奇淫巧技

当然位运算还有一些其他技巧，比如判断奇偶数：

```go
// 偶数
a & 1 == 0

// 奇数
a & 1 == 1
```

乘法和除法，右移1一位是除以2，左移一位是乘以2.

```go
x := 2
fmt.Println(x>>1) //1
fmt.Println(x<<1) //4
```


# 总结

位运算在带来程序性能提升的同时也降低代码可读性，所以我们得按需选择是否使用；

再一些底层库、框架代码对性能有极致追求的场景推荐使用，但在业务代码中对数据做加减乘除就没必要用位运算了，只会让后续的维护者一脸懵逼。

相关代码：[https://github.com/crossoverJie/xjson](https://github.com/crossoverJie/xjson)