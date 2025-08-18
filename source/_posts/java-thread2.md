---
title: java多线程（二）有返回值的多线程
date: 2016/5/27 17:39:16   
categories: 
- java多线程
tags: 
- Java
- Callable
- ExecutorService
- Future
- Executors
---
# 前言

之前我们使用多线程要么是继承`Thread`类，要么是实现`Runnable`接口，然后重写一下`run()`方法即可。
但是只有的话如果有死锁、对共享资源的访问和随时监控线程状态就不行了，于是在Java5之后就有了Callable接口。

----------

# 简单的实现有返回值的线程
代码如下：
`CallableFuture`类
```java
package top.crosssoverjie.study.Thread;

import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

public class CallableFuture {
	public static void main(String[] args) {
		//创建一个线程池
		ExecutorService pool = Executors.newFixedThreadPool(3) ;
		
		//创建三个有返回值的任务
		CallableTest2 c1 = new CallableTest2("线程1") ;
		CallableTest2 c2 = new CallableTest2("线程2") ;
		CallableTest2 c3 = new CallableTest2("线程3") ;
		
		Future f1 = pool.submit(c1) ;
		Future f2 = pool.submit(c2) ;
		Future f3 = pool.submit(c3) ;
		
		try {
			System.out.println(f1.get().toString());
			System.out.println(f2.get().toString());
			System.out.println(f3.get().toString());
		} catch (InterruptedException e) {
			e.printStackTrace();
		} catch (ExecutionException e) {
			e.printStackTrace();
		}finally{
			pool.shutdown();
		}
		
	}
}
```
<!--more-->
·CallableTest2·类：
```java
package top.crosssoverjie.study.Thread;

import java.util.concurrent.Callable;

public class CallableTest2 implements Callable {
	private String name ;

	public CallableTest2(String name) {
		this.name = name;
	}

	@Override
	public Object call() throws Exception {
		return name+"返回了东西";
	}
	
	
}
```
运行结果：
```
线程1返回了东西
线程2返回了东西
线程3返回了东西
```

----------
# 总结
以上就是一个简单的例子，需要了解更多详情可以去看那几个类的API。


