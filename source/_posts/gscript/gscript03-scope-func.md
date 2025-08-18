---
title: 自己动手写脚本解释器--实现作用域与函数调用
date: 2022/08/17 08:08:08 
categories: 
- gscript
- compiler
tags: 
- go
- antlr
---

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h594ovvpt6j20k00k0jse.jpg)

# 前言
上次利用 Antlr 重构一版 [用 Antlr 重构脚本解释器](https://crossoverjie.top/2022/08/08/gscript/gscript02-antlr-statement/) 之后便着手新增其他功能，也就是现在看到的支持了作用域以及函数调用。

```java
int b= 10;
int foo(int age){
	for(int i=0;i<10;i++){
		age++;
	}
	return b+age;
}
int add(int a,int b) {
	int e = foo(10);
	e = e+10;
	return a+b+3+e;
}
add(2,20);
// Output:65
```

<!--more-->

整个语法规则大部分参考了 Java，现阶段支持了：
- 函数声明与调用。
- 函数调用的入栈和出栈，保证了函数局部变量在函数退出时销毁。
- 作用域支持，内部作用域可以访问外部作用域的变量。
- 基本的表达式语句，如 `i++, !=,==`




这次实现的重点与难点则是作用域与函数调用，实现之后也算是满足了我的好奇心，不过在讲作用域与函数调用之前先来看看一个简单的变量声明与访问语句是如何实现的，这样后续的理解会更加容易。


# 变量声明

```java
int a=10;
a;
```
> 由于还没有实现内置函数，比如控制台输出函数 print()，所以这里就直接访问变量也能拿到数据

运行后结果如下：
![](https://tva1.sinaimg.cn/large/e6c9d24ely1h5904p530kj20nc0ewdgo.jpg)

首先看看变量声明语句的语法：

```antlr
variableDeclarators
    : typeType variableDeclarator (',' variableDeclarator)*
    ;

variableDeclarator
    : variableDeclaratorId ('=' variableInitializer)?
    ;
typeList
    : typeType (',' typeType)*
    ;
typeType
    : (functionType | primitiveType) ('[' ']')*
    ;
primitiveType
    : INT
    | STRING
    | FLOAT
    | BOOLEAN
    ;        
```
 只看语法不太直观，直接看下生成的 AST 树就明白了：
 ![](https://tva1.sinaimg.cn/large/e6c9d24ely1h5907v0pzmj20w80gkmy9.jpg)
 编译期
 左边这棵 `BlockVardeclar` 树对应的就是  `int a=10;`，右边的 `blockStm` 对应的就是变量访问 `a`。
 
 整个程序的运行过程分为编译期和运行期，对应的流程：
 - 遍历 AST 树，做语义分析，生成对应的符号表、类型表、引用消解、还有一些语法校验，比如变量名、函数名是否重复、是否能访问私有变量等。
 - 运行期：从编译期中生成的符号表、类型表中获取数据，执行具体的代码逻辑。


## 访问 AST

对于刚才提到的编译期和运行期其实分别对应两种访问 `AST` 的方式，这也是 `Antlr` 所提供两种方式。

### Listener 模式

第一种是 `Listener` 模式，就这名字也能猜到是如何运行的；我们需要实现 Antlr 所提供的接口，这些接口分别对应 AST 树中的不同节点。

接着 Antlr 会自动遍历这棵树，当访问和退出某个节点时变会回调我们自定义的方法，这些接口都是没有返回值的，所以我们需要将遍历过程中的数据自行存放起来。

这点非常适合上文提到的编译期，遍历过程中产生的数据自然就会存放到符号表、类型表这些容器中。

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h591ozeop0j20u00uote1.jpg)
以这段代码为例，我们实现了程序根节点、for循环节点的进入和退出 Listener，当 Antlr 运行到这些节点时便会执行其中的逻辑。

[https://github.com/crossoverJie/gscript/blob/main/resolver/type_scope_resolver.go](https://github.com/crossoverJie/gscript/blob/main/resolver/type_scope_resolver.go)

### Visitor 模式

`Visitor` 模式正好和 `Listener` 相反，这是由我们自行控制需要访问哪个 AST 节点，同时需要在每次访问之后返回数据，这点非常适合来做程序运行期。

配合在编译期中存放的数据，便可以实现各种特性了。

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h5922ws8o0j21n00tcgsc.jpg)

以上图为例，在访问 Prog 节点时便可以从编译期中拿到当前节点所对应的作用域 `scope`，同时我们可以自行控制访问下一个节点 `VisitBlockStms`，访问其他节点当然也是可以的，不过通常我们还是按照语法中定义的结构进行访问。



# 作用域

即便是同一个语法生成的 AST 是相同的，但我们在遍历 AST 时实现不同也就会导致不同的语义，这就是各个语言语义分析的不同之处。

> 比如 Java 不允许在子作用域中声明和父作用域中相同的变量，但 JavaScript 却是可以的。

有了上面的基础下面我们来看看作用域是如何实现的。

```java
int a=10;
a;
```

还是以这段代码为例：

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h59355xwevj21bw0rsq9k.jpg)

这里我简单画了下流程：

在编译期间会会为当前节点写入一个 `scope`，以及在 `scope` 中写入变量 `“a”`。

> 这里的写入 scope 和写入变量是分为两次 Listener 进行的，具体代码实现在下面查看源码。

第一次：
[https://github.com/crossoverJie/gscript/blob/main/resolver/type_scope_resolver.go#L21](https://github.com/crossoverJie/gscript/blob/main/resolver/type_scope_resolver.go#L21)

第二次：
[https://github.com/crossoverJie/gscript/blob/main/resolver/type_resolver.go#L59](https://github.com/crossoverJie/gscript/blob/main/resolver/type_resolver.go#L59)

接着是运行期，从编译期中生成的数据拿到 `scope` 以及其中的变量，获取变量时有一个细节：
当前 scope 中如果获取不到需要尝试从父级 `scope` 中获取，比如如下情况：


```java
int b= 10;
int foo(){
	return b;
}
```
这里的 b 在当前函数作用域中是获取不到的，只能在父级 `scope` 中获取。

> 父级 scope 的关系是在创建 scope 的时候维护进去的，默认当前 scope 就是写入时 scope 的父级。

关键代码试下如下图：
![](https://tva1.sinaimg.cn/large/e6c9d24ely1h593bq2mrgj211e0lwtby.jpg)

第四步获取变量的值也是需要访问到 AST 中的字面量节点获取值即可，核心代码如下：
![](https://tva1.sinaimg.cn/large/e6c9d24ely1h593fchoccj20wa0ia3zy.jpg)
![](https://tva1.sinaimg.cn/large/e6c9d24ely1h593fwqkgmj217p0u078h.jpg)


# 函数
函数的调用最核心的就是在运行时需要把当前函数中的所有数据入栈，访问完毕后出栈，这样才能实现函数退出后自动释放函数体类的数据。

核心代码如下：
![](https://tva1.sinaimg.cn/large/e6c9d24ely1h593mb2qrqj216y0u0n37.jpg)

```java
int b= 10;
int foo(){
	return b;
}
int func(int a,int b) {
	int e = foo();
	return a+b+3+e;
}
func(2,20);
```

即便是有上面这类函数类调其他函数情况也不必担心，无非就是在执行函数体的时候再往栈中写入数据而已，函数退出后会依次退出栈帧。

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h593r5bgs5j20rs11bq4b.jpg)

有点类似于匹配括号的算法 `{[()]}`，本质上就是递归调用。

# 总结

限于篇幅其中的许多细节没有仔细讨论，感兴趣的朋友可以直接跑跑单测，debug 试试。

[https://github.com/crossoverJie/gscript/blob/main/compiler_test.go](https://github.com/crossoverJie/gscript/blob/main/compiler_test.go)

目前的版本还比较初级，比如基本类型还只有 int，也没有一些常用的内置函数。

后续会逐步完善，比如新增：
- 函数多返回值。
- 自定义类型
- 闭包

等特性，这个坑会一直填下去，希望在年底可以用 `gscript` 写一个 `web` 服务端那就算是里程碑完成了。

现阶段也实现了一个简易的 `REPL` 工具，大家可以安装试用：
![](https://tva1.sinaimg.cn/large/e6c9d24ely1h594523npmj20bc0de74n.jpg)

源码地址：
[https://github.com/crossoverJie/gscript](https://github.com/crossoverJie/gscript)