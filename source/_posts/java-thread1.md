---
title: java多线程（一）多线程基础
date: 2016/5/14 20:09:10  
categories:
- java多线程
tags: 
- Java 
- Thread
- Runnable
---
# 前言

本文主要讲解java多线程的基础，以及一些常用方法。关于线程同步、ExecutorService框架我会放到后续的文章进行讲解。


----------
# 进程与线程的区别
## 进程 
进程简单的来说就是在内存中运行的应用程序，一个进程可以启动多个线程。
比如在windows中一个运行EXE文件就是一个进程。
## 线程
同一个线程中的进程共用相同的地址空间，同时共享进程所拥有的内存和其他资源。
<!--more-->

----------
# 线程Demo-继承Thread类
首先我们我们继承`java.lang.Thread`类来创建线程。
```java
package top.crosssoverjie.study.Thread;

public class TestThread {
	public static void main(String[] args) {
		System.out.println("主线程ID是：" + Thread.currentThread().getId());
		MyThread my = new MyThread("线程1");
		my.start() ;
		
		MyThread my2 = new MyThread("线程2") ;
		/**
		 * 这里直接调用my2的run()方法。
		 */
		my2.run() ;
	}

}

class MyThread extends Thread {
	private String name;

	public MyThread(String name) {
		this.name = name;
	}

	@Override
	public void run() {
		System.out.println("名字：" + name + "的线程ID是="
				+ Thread.currentThread().getId());
	}

}
```
输出结果:
```java
主线程ID是：1
名字：线程2的线程ID是=1
名字：线程1的线程ID是=9
```
由输出结果我们可以得出以下结论：
> - my和my2的线程ID不相同，my2和主线程ID相同。说明直接调用`run()`方法不会创建新的线程，而是在主线程中直接调用的`run()`方法,和普通的方法调用没有区别。
> - 虽然my的`start()`方法是在my2的`run()`方法之前调用，但是却是后输出内容，说明新建的线程并不会影响主线程的执行。

----------

# 线程Demo-实现Runnable接口
除了继承`java.lang.Thread`类之外，我们还可以实现`java.lang.Runnable`接口来创建线程。
```java
package top.crosssoverjie.study.Thread;

public class TestRunnable {
	public static void main(String[] args) {
		System.out.println("主线程的线程ID是"+Thread.currentThread().getId());
		MyThread2 my = new MyThread2("线程1") ;
		Thread t = new Thread(my) ;
		t.start() ;
		
		MyThread2 my2 = new MyThread2("线程2") ;
		Thread t2 = new Thread(my2) ;
		/**
		 * 方法调用，并不会创建线程，依然是主线程
		 */
		t2.run() ;
	}
}

class MyThread2 implements Runnable{
	private String name ;
	public MyThread2(String name){
		this.name = name ;
	}

	@Override
	public void run() {
		System.out.println("线程"+name+"的线程ID是"+Thread.currentThread().getId());
	}
	
	
}
```
输出结果:
```java
主线程的线程ID是1
线程线程2的线程ID是1
线程线程1的线程ID是9
```
notes:
> - 实现Runnable的方式需要将实现Runnable接口的类作为参数传递给Thread，然后通过Thread类调用`Start()`方法来创建线程。
> - 这两种方式都可以来创建线程，至于选择哪一种要看自己的需求。直接继承Thread类的话代码要简洁一些，但是由于java只支持单继承，所以如果要继承其他类的同时需要实现线程那就只能实现Runnable接口了，这里更推荐实现Runnable接口。

实际上如果我们查看Thread类的源码我们会发现Thread是实现了Runnable接口的：
![Thread源码](http://i.imgur.com/FLsghcS.png)

----------
# 线程中常用的方法
| 序号        | 方法           | 介绍  |
| ------------- |:-------------| :-----|
| 1 | `public void start()` | 使该线程执行，java虚拟机会调用该线程的`run()`方法。|
| 2 | `public final void setName(String name)`      |修改线程名称。 |
| 3 | `public final void setPriority(int privority)`      |修改线程的优先级。|
| 4 | `public final void setDaemon(false on)`      |将该线程标记为守护线程或用户线程，当正在运行线程都是守护线程时，java虚拟机退出，该方法必须在启动线程前调用。|
| 5 | `public final void join(long mills)`      |等待该线程的终止时间最长为mills毫秒。|
| 6 | `public void interrupt()`      |中断线程。|
| 7 | `public static boolean isAlive()`      |测试线程是否处于活动状态。如果该线程已经启动尚未终止，则为活动状态。|
| 8 | `public static void yield()`      |暂停当前线程执行的对象，并执行其他线程。|
| 9 | `public static void sleep(long mills)`      |在指定毫秒数内，让当前执行的线程休眠(暂停)。|
| 10| `public static Thread currentThread()`      |返回当前线程的引用。|
## 方法详解- `public static void sleep(long mills)`
```java
package top.crosssoverjie.study.Thread;

public class TestSleep {

	private int i = 10 ;
	private Object ob = new Object() ;
	
	public static void main(String[] args) {
		TestSleep t = new TestSleep() ;
		MyThread3 thread1 = t.new MyThread3() ;
		MyThread3 thread2 = t.new MyThread3() ;
		thread1.start() ;
		thread2.start() ;
	}
	
	class MyThread3 extends Thread{
		@Override
		public void run() {
			synchronized (ob) {
				i++ ;
				System.out.println("i的值："+i);
				System.out.println("线程："+Thread.currentThread().getName()+"进入休眠状态");
				try {
					Thread.currentThread().sleep(1000) ;
				} catch (Exception e) {
					e.printStackTrace();
				}
				System.out.println("线程："+Thread.currentThread().getName()+"休眠结束");
				i++;
				System.out.println("i的值>："+i);
			}
		}
	}
	
}
```
输出结果：
```java
i的值：11
线程：Thread-0进入休眠状态
线程：Thread-0休眠结束
i的值>：12
i的值：13
线程：Thread-1进入休眠状态
线程：Thread-1休眠结束
i的值>：14
```
由输出结果我们可以得出：
> - 当Thread0进入休眠状态时，Thread1并没有继续执行，而是等待Thread0休眠结束释放了对象锁，Thread1才继续执行。
> 当调用`sleep()`方法时，必须捕获异常或者向上层抛出异常。当线程休眠时间满时，并不一定会马上执行，因为此时有可能CPU正在执行其他的任务，所以调用了`sleep()`方法相当于线程进入了阻塞状态。

## 方法详解- `public static void yield()`
```java
package top.crosssoverjie.study.Thread;

public class Testyield {
	public static void main(String[] args) {
		MyThread4 my = new MyThread4() ;
		my.start() ;
	}
}
class MyThread4 extends Thread{
	@Override
	public void run() {
		long open = System.currentTimeMillis();
		int count= 0 ;
		for(int i=0 ;i<1000000;i++){
			count= count+(i+1);
//			Thread.yield() ;
		}
		long end = System.currentTimeMillis();
		System.out.println("用时："+(end-open)+"毫秒");
	}
}
```
输出结果:
`用时：1毫秒`
如果将 Thread.yield()注释取消掉，输出结果:
`用时：116毫秒`
> - 调用`yield()`方法是为了让当前线程交出CPU权限，让CPU去执行其他线程。它和`sleep()`方法类似同样是不会释放锁。但是`yield()`不能控制具体的交出CUP的时间。并且它只能让相同优先级的线程获得CPU执行时间的机会。
> - 调用`yield()`方法不会让线程进入阻塞状态，而是进入就绪状态，它只需要等待重新获取CPU的时间，这一点和`sleep()`方法是不一样的。

## 方法详解- `public final void join()`
在很多情况下我们需要在子线程中执行大量的耗时任务，但是我们主线程又必须得等待子线程执行完毕之后才能结束，这就需要用到 `join()`方法了。`join()`方法的作用是等待线程对象销毁，如果子线程执行了这个方法，那么主线程就要等待子线程执行完毕之后才会销毁，请看下面这个例子：
```java
package top.crosssoverjie.study.Thread;

public class Testjoin {
	public static void main(String[] args) throws InterruptedException {
		new MyThread5("t1").start() ;
		for (int i = 0; i < 10; i++) {
			if(i == 5){
				MyThread5 my =new MyThread5("t2") ;
				my.start() ;
				my.join() ;
			}
			System.out.println("main当前线程："+Thread.currentThread().getName()+" "+i);
		}
	}
}
class MyThread5 extends Thread{
	
	public MyThread5(String name){
		super(name) ;
	}
	@Override
	public void run() {
		for (int i = 0; i < 5; i++) {
			System.out.println("当前线程："+Thread.currentThread().getName()+" "+i);
		}
	}
}
```
输出结果：
```java
main当前线程：main 0
当前线程：t1 0
当前线程：t1 1
main当前线程：main 1
当前线程：t1 2
main当前线程：main 2
当前线程：t1 3
main当前线程：main 3
当前线程：t1 4
main当前线程：main 4
当前线程：t2 0
当前线程：t2 1
当前线程：t2 2
当前线程：t2 3
当前线程：t2 4
main当前线程：main 5
main当前线程：main 6
main当前线程：main 7
main当前线程：main 8
main当前线程：main 9
```
如果我们把`join()`方法注释掉之后：
```java
main当前线程：main 0
当前线程：t1 0
main当前线程：main 1
当前线程：t1 1
main当前线程：main 2
当前线程：t1 2
main当前线程：main 3
当前线程：t1 3
main当前线程：main 4
当前线程：t1 4
main当前线程：main 5
main当前线程：main 6
main当前线程：main 7
main当前线程：main 8
main当前线程：main 9
当前线程：t2 0
当前线程：t2 1
当前线程：t2 2
当前线程：t2 3
当前线程：t2 4
```
由上我们可以得出以下结论：
> - 在使用了`join()`方法之后主线程会等待子线程结束之后才会结束。

## 方法详解- `setDaemon(boolean on)`,`getDaemon()`
用来设置是否为守护线程和判断是否为守护线程。
notes：
> - 守护线程依赖于创建他的线程，而用户线程则不需要。如果在`main()`方法中创建了一个守护线程，那么当main方法执行完毕之后守护线程也会关闭。而用户线程则不会，在JVM中垃圾收集器的线程就是守护线程。


----------
# 优雅的终止线程
有三种方法可以终止线程，如下：
1. 使用退出标识，使线程正常的退出，也就是当`run()`方法完成后线程终止。
2. *使用`stop()`方法强行关闭，这个方法现在已经被废弃，不推荐使用*
3. 使用`interrupt()`方法终止线程。

具体的实现代码我将在下一篇博文中将到。。

# 线程的优先级
在操作系统中线程是分优先级的，优先级高的线程CPU将会提供更多的资源，在java中我们可以通过`setPriority(int newPriority)`方法来更改线程的优先级。
在java中分为1~10这个十个优先级，设置不在这个范围内的优先级将会抛出`IllegalArgumentException`异常。
java中有三个预设好的优先级：
> - `public final static int MIN_PRIORITY = 1;`
> - `public final static int NORM_PRIORITY = 5;`
> - `public final static int MAX_PRIORITY = 10;`


----------
# 参考
> - [如何终止线程](http://blog.csdn.net/anhuidelinger/article/details/11746365)
> - [java多线程学习](http://www.mamicode.com/info-detail-517008.html)

# java多线程思维图
![](http://i.imgur.com/PCfshMD.png)

----------

# 总结
以上就是我总结的java多线程基础知识，后续会补充线程关闭、线程状态、线程同步和有返回结果的多线程。