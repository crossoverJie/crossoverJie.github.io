---
title: 简单的 for 循环也会踩的坑
date: 2021/12/28 08:12:16 
categories: 
- Go
tags: 
- for
- goroutine
---

![](https://s2.loli.net/2023/09/24/gohfjR5CtU9Qvr6.png)

# 前言

最近实现某个业务时，需要读取数据然后再异步处理；在 Go 中实现起来自然就比较简单，伪代码如下：

```go
	list := []*Demo{{"a"}, {"b"}}
	for _, v := range list {
		go func() {
			fmt.Println("name="+v.Name)
		}()
	}
	
	type Demo struct {
		Name string
	}
```

<!--more-->

看似非常简单几行代码却和我们的预期不符，打印之后输出的是：

```shell
name=b
name=b
```

并不是我们预期的：

```shell
name=a
name=b
```

# 坑一
由于写 go 的资历尚浅、道行更是浅薄，这 `bug` 我硬是找了个把小时；刚开始还以为是数据源的问题，经历了好几轮自我怀疑。总之过程先不表，先看看如何修复这个问题。


首先第一种办法是使用临时变量：

```go
	list := []*Demo{{"a"}, {"b"}}
	for _, v := range list {
		temp:=v
		go func() {
			fmt.Println("name="+temp.Name)
		}()
	}
```

这样便可正确输出，其实从这种写法中也能看出问题的端倪。

在第一种没有使用临时变量时，主协程很快就运行完毕，这时候打印的子协程可能还没运行；当开始运行的时候，这里的 v 已经被最后一个赋值了。

所以这里打印的一直都是最后一个变量。

而使用临时变量会将当前遍历的值拷贝一份，自然就不会互相影响了。

---

当然除了临时变量也可使用闭包解决。

```go
	list := []*Demo{{"a"}, {"b"}}
	for _, v := range list {
		go func(temp *Demo) {
			fmt.Println("name="+temp.Name)
		}(v)
	}
```

将参数通过闭包传递时，每个 `goroutine` 都会在自己的栈中存放一份参数的拷贝，这样也能区分了。



# 坑二

与之类似的还有第二个坑：

```go
	list2 := []Demo{{"a"}, {"b"}}
	var alist []*Demo
	for _, test := range list2 {
		alist = append(alist, &test)
	}
	fmt.Println(alist[0].Name, alist[1].Name)
```

这段代码与我们预期不不符：

```shell
b b
```

但我们稍加修改就可以了：

```go
	list2 := []Demo{{"a"}, {"b"}}
	var alist []Demo
	for _, test := range list2 {
		fmt.Printf("addr=%p\n", &test)
		alist = append(alist, test)
	}
	fmt.Println(alist[0].Name, alist[1].Name)
```

```shell
addr=0xc000010240
addr=0xc000010240
a b
```

顺便打印了内存地址，其实从结果中大概就能猜到原因；每次遍历打印的内存地址都是相同，所以如果我们存放的是指针，本质上存储的都是同一块内存地址的内容，所以值相同。

而如果我们只存储值，不存指针自然也不会有这个问题。

但如果想使用指针如何处理呢?

```go
	list2 := []Demo{{"a"}, {"b"}}
	var alist []*Demo
	for _, test := range list2 {
		temp := test
		//fmt.Printf("addr=%p\n", &test)
		alist = append(alist, &temp)
	}
	fmt.Println(alist[0].Name, alist[1].Name)
```

也简单，同样的使用临时变量即可。

通过官方源码可以得知，`for range` 只是语法糖，本质上也是 for 循环；因为每次都是对同一个对象遍历赋值，所以便会出现这样的“乌龙”。

![](https://s2.loli.net/2023/09/24/ortJYa4fk3QCz18.png)



#  defer 的坑

`for` 循环 + `defer` 也是组合坑（虽然不推荐这么用），还是先来看个例子：

```go

// demo1
func main() {
	a := []int{1, 2, 3}
	for _, v := range a {
		defer fmt.Println(v)
	}
}

// demo2
func main() {
	a := []int{1, 2, 3}
	for _, v := range a {
		defer func() {
			fmt.Println(v)
		}()
	}
}
```

分别输出：

```shell
//demo1
3
2
1
//demo2
3
3
3
```

`demo1`的结果很好理解，`defer` 可以理解为将执行语句放入到栈中，所以呈现的结果是先进后出。

而`demo2`中，由于是闭包，闭包对变量 v 持有的是引用，所以在最终延迟执行时 v 已经被最后一个值赋值，所以打印出来都是相同的。

解决方法与上文类似，传入参数即可解决：

```go
	for _, v := range a {
		defer func(v int) {
			fmt.Println(v)
		}(v)
	}
```

这类细节问题日常开发大概率是碰不上的，最有可能遇到的就是面试了，所以多了解了解也没坏处。

# 总结

类似于第一种情况在 for 循环中 `goroutine` 调用，我觉得  `IDE` 完全是可以做到提醒的；比如 `IDEA` 中就把大部分认为可能发的错误包含进去，期待后续 `goland` 的更新。

但其实这几种错误官方博客已经提醒过了。

![](https://tva1.sinaimg.cn/large/008i3skNly1gxstzwhykqj311f0u0q71.jpg)
[https://github.com/golang/go/wiki/CommonMistakes#using-reference-to-loop-iterator-variable](https://github.com/golang/go/wiki/CommonMistakes#using-reference-to-loop-iterator-variable)
只是大部分人估计都没去看过，这事之后我也得花时间好好阅读下。
