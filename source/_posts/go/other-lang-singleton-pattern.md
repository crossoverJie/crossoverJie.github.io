---
title: 不同语言对单例模式的不同实现
date: 2020/10/09 08:10:36 
categories: 
- 设计模式
tags: 
- Golang
- Java
- Python
---

![](https://i.loli.net/2020/10/09/MbZHxvDFeyhmAtQ.jpg)

# 前言

前段时间在用 `Python` 实现业务的时候发现一个坑，准确的来说是对于 `Python` 门外汉容易踩的坑；

大概代码如下：

```python
class Mom(object):
    name = ''
    sons = []

if __name__ == '__main__':
    m1 = Mom()
    m1.name = 'm1'
    m1.sons.append(['s1', 's2'])
    print '{} sons={}'.format(m1.name, m1.sons)

    m2 = Mom()
    m2.name = 'm2'
    m2.sons.append(['s3', 's4'])
    print '{} sons={}'.format(m2.name, m2.sons)
```

首先定义了一个 `Mom` 的类，它包含了一个字符串类型的 `name` 与列表类型的 `sons` 属性；

<!--more-->

在使用时首先创建了该类的一个实例 `m1` 并往 `sons` 中写入一个列表数据；紧接着又创建了一个实例 `m2` ，也往 `sons` 中写入了另一个列表数据。

如果是一个 `Javaer` 很少写 `Python` 看到这样的代码首先想到的输出应该是：

```python
m1 sons=[['s1', 's2']]
m2 sons=[['s3', 's4']]
```

但其实最终的输出结果是：

```python
m1 sons=[['s1', 's2']]
m2 sons=[['s1', 's2'], ['s3', 's4']]
```

如果想要达到期望值需要稍微修改一下：

```python
class Mom(object):
    name = ''

    def __init__(self):
        self.sons = []
```

只需要修改类的定义就可以了，我相信即使没有 `Python` 相关经验对比这两个代码应该也能猜到原因：

在 `Python` 中如果需要将变量作为实例变量（也就是每个我们期望的输出）时，需要将变量定义到构造函数中，通过 `self` 访问。

如果只放在类中，和 `Java` 中的 `static` 静态变量效果类似；这些数据由类共享，也就能解释为什么会出现第一种情况，因为其中的 `sons` 是由 `Mom` 类共享，所以每次都会累加。

# Python 单例

既然 `Python` 可以通过类变量达到变量在同一个类中共享的效果，那是否可以实现单例模式呢？

可以利用 `Python` 的 `metaclass` 的特性，动态的控制类的创建。

```python
class Singleton(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super(Singleton, cls).__call__(*args, **kwargs)
        return cls._instances[cls]
```

首先创建一个 `Singleton` 的基类，然后我们在我们需要实现单例的类中将其作为 `metaclass`

```python
class MySQLDriver:
    __metaclass__ = Singleton

    def __init__(self):
        print 'MySQLDriver init.....'
```

这样`Singleton` 就可以控制 `MySQLDriver` 这个类的创建了；其实在 `Singleton` 中的 `__call__` 可以很容易理解这个单例创建的过程：

- 定义一个私有的类属性 `_instances` 的字典（也就是 `Java` 中的 `map`）可以做到在整个类中共享，无论创建多少个实例。
- 当我们自定义类使用了 `__metaclass__ = Singleton` 后，便可以控制自定义类的创建了；如果已经创建了实例，那就直接从 `_instances` 取出对象返回，不然就创建一个实例并写回到 `_instances` ，有点 `Spring` 容器的感觉。

```python
if __name__ == '__main__':
    m1 = MySQLDriver()
    m2 = MySQLDriver()
    m3 = MySQLDriver()
    m4 = MySQLDriver()
    print m1
    print m2
    print m3
    print m4

MySQLDriver init.....
<__main__.MySQLDriver object at 0x10d848790>
<__main__.MySQLDriver object at 0x10d848790>
<__main__.MySQLDriver object at 0x10d848790>
<__main__.MySQLDriver object at 0x10d848790>
```

最后我们通过实验结果可以看到单例创建成功。

# Go 单例

由于最近团队中有部分业务开始在用 `go` ，所以也想看看在 `go` 中如何实现单例。

```go
type MySQLDriver struct {
	username string
}
```

在这样一个简单的结构体（可以简单理解为 `Java` 中的 `class`）中是没法类似于 `Python` 和 `Java` 一样可以声明类共享变量的；`go` 语言中不存在 `static` 的概念。

但我们可以在包中声明一个全局变量来达到同样的效果：

```go
import "fmt"

type MySQLDriver struct {
	username string
}

var mySQLDriver *MySQLDriver

func GetDriver() *MySQLDriver {
	if mySQLDriver == nil {
		mySQLDriver = &MySQLDriver{}
	}
	return mySQLDriver
}
```

这样在使用时：

```go
func main() {
	driver := GetDriver()
	driver.username = "cj"
	fmt.Println(driver.username)

	driver2 := GetDriver()
	fmt.Println(driver2.username)

}
```

就不需要直接构造 `MySQLDriver`  ，而是通过`GetDriver()` 函数来获取，通过 `debug` 也能看到 `driver` 和 `driver1` 引用的是同一个内存地址。

![](https://i.loli.net/2020/10/09/BkIGFx3tJjWRSiY.jpg)

这样的实现常规情况是没有什么问题的，机智的朋友一定能想到和 `Java` 一样，一旦并发访问就没那么简单了。

在 `go` 中，如果有多个 `goroutine` 同时访问`GetDriver()` ，那大概率会创建多个 `MySQLDriver` 实例。

这里说的没那么简单其实是相对于 `Java` 来说的，`go` 语言中提供了简单的 `api` 便可实现临界资源的访问。

```go
var lock sync.Mutex

func GetDriver() *MySQLDriver {
	lock.Lock()
	defer lock.Unlock()
	if mySQLDriver == nil {
		fmt.Println("create instance......")
		mySQLDriver = &MySQLDriver{}
	}
	return mySQLDriver
}

func main() {
	for i := 0; i < 100; i++ {
		go GetDriver()
	}

	time.Sleep(2000 * time.Millisecond)
}
```

稍加改造上文的代码，加入了

```go
lock.Lock()
defer lock.Unlock()
```

代码就能简单的控制临界资源的访问，即便我们开启了100个协程并发执行，`mySQLDriver` 实例也只会被初始化一次。

- 这里的 `defer` 类似于 `Java` 中的 `finally` ，在方法调用前加上 `go` 关键字即可开启一个协程。

虽说能满足并发要求了，但其实这样的实现也不够优雅；仔细想想这里

```go
mySQLDriver = &MySQLDriver{}
```

创建实例只会调用一次，但后续的每次调用都需要加锁从而带来了不必要的开销。

这样的场景每个语言都是相同的，拿 `Java` 来说是不是经常看到这样的单例实现：

```java
public class Singleton {
    private Singleton() {}
   private volatile static Singleton instance = null;
   public static Singleton getInstance() {
        if (instance == null) {     
         synchronized (Singleton.class){
           if (instance == null) {    
             instance = new Singleton();
               }
            }
         }
        return instance;
    }
}
```

这是一个典型的双重检查的单例，这里做了两次检查便可以避免后续其他线程再次访问锁。

同样的对于 `go` 来说也类似：

```go
func GetDriver() *MySQLDriver {
	if mySQLDriver == nil {
		lock.Lock()
		defer lock.Unlock()
		if mySQLDriver == nil {
			fmt.Println("create instance......")
			mySQLDriver = &MySQLDriver{}
		}
	}
	return mySQLDriver
}
```

和 `Java` 一样，在原有基础上额外做一次判断也能达到同样的效果。

但有没有觉得这样的代码非常繁琐，这一点 `go` 提供的 `api` 就非常省事了：

```go
var once sync.Once

func GetDriver() *MySQLDriver {
	once.Do(func() {
		if mySQLDriver == nil {
			fmt.Println("create instance......")
			mySQLDriver = &MySQLDriver{}
		}
	})
	return mySQLDriver
}
```

本质上我们只需要不管在什么情况下  `MySQLDriver` 实例只初始化一次就能达到单例的目的，所以利用 `once.Do()` 就能让代码只执行一次。

![](https://i.loli.net/2020/10/09/kvKn5QFczBYH6j7.jpg)

查看源码会发现 `once.Do()` 也是通过锁来实现，只是在加锁之前利用底层的原子操作做了一次校验，从而避免每次都要加锁，性能会更好。

# 总结

相信大家日常开发中很少会碰到需要自己实现一个单例；首先大部分情况下我们都不需要单例，即使是需要，框架通常也都有集成。

类似于 `go` 这样框架较少，需要我们自己实现时其实也不需要过多考虑并发的问题；摸摸自己肚子左上方的位置想想，自己写的这个对象真的同时有几百上千的并发来创建嘛？

不过通过这个对比会发现 `go` 的语法确实要比 `Java` 简洁太多，同时轻量级的协程以及简单易用的并发工具支持看起来都要比 `Java` 优雅许多；后续有机会再接着深入。

参考链接：

[Creating a singleton in Python](https://stackoverflow.com/questions/6760685/creating-a-singleton-in-python)

[How to implement Singleton Pattern in Go](https://progolang.com/how-to-implement-singleton-pattern-in-go/)
