---
title: Java笔记（一）Java的反射机制
date: 2016/5/10 21:01:36 
categories: 
- Java笔记
tags:
- Java
- Reflect
---
# 前言

java反射机制指的是在java运行过程中，对于任意的类都可以知道他的所有属性以及方法，对于任意一个对象都可以任意的调用他的属性和方法，这种动态获取对象信息和动态调用对象方法的功能称为java反射机制，但是反射使用不当会造成很高的成本。

# 简单实例

----------


## 反射获取类名称

```java
package top.crosssoverjie.study;
public class Reflect {
    public static void main(String[] args) {
        Class<Reflect> c1 = Reflect.class;
        System.out.println(c1.getName());
        
        Reflect r1 = new Reflect() ;
        Class<Reflect> c2 = (Class<Reflect>) r1.getClass() ;
        System.out.println(c2.getName());
        
        try {
            Class<Reflect> c3 = (Class<Reflect>) Class.forName("top.crosssoverjie.study.Reflect");
            System.out.println(c3.getName());
        } catch (ClassNotFoundException e) {
            e.printStackTrace();
        }
    }
}
```
<!--more-->
输出结果：

```java
top.crosssoverjie.study.Reflect
top.crosssoverjie.study.Reflect
top.crosssoverjie.study.Reflect  
```

以上的 c1,c2,c3是完全一样的，他们都有一个统一的名称：叫做Reflect类的类类型。

----------
# 反射的用处

## 获取成员方法

```java
public Method getDeclaredMethod(String name,Class<?>...parameterTypes)//得到该类的所有方法，但是不包括父类的方法。
public Method getMethod(String name,Class<?>...parameterTypes)//获得该类的所有public方法，包括父类的。
```

通过反射获取成员方法调用的实例:
```java
package top.crosssoverjie.study;

import java.lang.reflect.Method;

public class Person {
	private String name="crossover" ;
	private String msg ;
	
	public Person(String name, String msg) {
		this.name = name;
		this.msg = msg;
		System.out.println(name+"的描述是"+msg);
	}

	public Person() {
		super();
	}

	public void say(String name ,String msg){
		System.out.println(name+"说："+msg);
	}
	
	public String getName() {
		return name;
	}
	public void setName(String name) {
		this.name = name;
	}
	public String getMsg() {
		return msg;
	}
	public void setMsg(String msg) {
		this.msg = msg;
	}
	
	public static void main(String[] args) {
		try {
			//首先获取类类型
			Class c1 = Class.forName("top.crosssoverjie.study.Person") ;
			
			//通过newInstance()方法生成一个实例
			Object o1 = c1.newInstance() ;
			
			//获取该类的say方法
			Method m1 = c1.getMethod("say", String.class,String.class) ;
			
			//通过invoke方法调用该方法
//			m1.invoke(o1, "张三","你好啊") ;
			
			Method[] methods = c1.getDeclaredMethods() ;
//			for(Method m : methods){
//				System.out.println(m.getName());
//			}
			
			Method[] methods2 = c1.getMethods() ;
			for (Method method : methods2) {
				System.out.println(method.getName());
			}
			
		} catch (Exception e) {
			e.printStackTrace();
		}
		
	}
}

```
输出结果：
```java
张三说：你好啊
```

所以我们只要知道类的全限定名就可以任意的调用里面的方法。

----------

```java
Method[] methods = c1.getDeclaredMethods() ;
for(Method m : methods){
	System.out.println(m.getName());
}
```

输出结果：
```java
main
getName
setName
say
getMsg
setMsg
```

使用的还是之前那个Person类，所以这里只写了关键代码。这里输出的是Person的所有public方法。

如果我们调用`getMethods()`方法会是什么结果呢？
```java
Method[] methods2 = c1.getMethods() ;
for (Method method : methods2) {
	System.out.println(method.getName());
}
```

输出结果:
```java
main
getName
setName
say
getMsg
setMsg
wait
wait
wait
hashCode
getClass
equals
toString
notify
notifyAll
```

这时我们会发现这里输出的结果会比刚才多得多，这时因为`getMethods()`方法返回的是包括父类的所有方法。

----------

## 获取成员变量
我们还可以通过反射来获取类包括父类的成员变量，主要方法如下：
```java
public Field getDeclaredFiled(String name)//获得该类所有的成员变量，但不包括父类的。
public Filed getFiled(String name)//获得该类的所有的public变量，包括其父类的。
```

还是按照之前例子中的Person类举例，他具有两个成员变量：
```java
	private String name="crossover" ;
	private String msg ;
```
我们可以通过以下方法来获取其中的成员变量：
```java
Class c1 = Class.forName("top.crosssoverjie.study.Person") ;
Field field = c1.getDeclaredField("name");//获取该类所有的成员属性
```

通过以下例子可以获取指定对象上此field的值：
```java
package top.crosssoverjie.study;

import java.io.File;
import java.lang.reflect.Field;

public class Reflect {
	public static void main(String[] args) {
		try {
			Class c1 = Class.forName("top.crosssoverjie.study.Person");
			Field field = c1.getDeclaredField("name") ;
			Object o1 = c1.newInstance() ;
			/**
			 * 由于Person类中的name变量是private修饰的，
			 * 所以需要手动开启允许访问，是public修饰的就不需要设置了
			 */
			field.setAccessible(true);
			Object name = field.get(o1) ;
			System.out.println(name);
		} catch (Exception e) {
			e.printStackTrace() ;
		}
//		Class<Reflect> c1 = Reflect.class;
//		System.out.println(c1.getName());
//		
//		Reflect r1 = new Reflect() ;
//		Class<Reflect> c2 = (Class<Reflect>) r1.getClass() ;
//		System.out.println(c2.getName());
//		
//		try {
//			Class<Reflect> c3 = (Class<Reflect>) Class.forName("top.crosssoverjie.study.Reflect");
//			System.out.println(c3.getName());
//		} catch (ClassNotFoundException e) {
//			e.printStackTrace();
//		}
	}
}

```
输出结果：
```java
crossover
```

我们也可以通过方法`getDeclaredFieds()`方法来获取所有的成员变量，返回是是一个`Field[]`数组，只需要遍历这个数组即可获所有的成员变量。例子如下：

```java
Field[] fields = c1.getDeclaredFields() ;
for(Field f :fields){
	System.out.println(f.getName());
}
```
输出结果如下：
```java
name
msg
```

## 获取构造方法
可以通过以下两个方法来获取构造方法：
```java
public Constructor getDeclaredConstructor(Class<?>...parameterTypes)//获取该类的所有构造方法，不包括父类的。
public Constructor getConstructor(Class<?>...parameterTypes)//获取该类的所有public修饰的构造方法，包括父类的。
```
在之前的Person类中有以下的构造方法：
```java
	public Person(String name, String msg) {
		this.name = name;
		this.msg = msg;
	}
```
我们可以通过以下方法来获取Person类的构造方法：
```java
Constructor dc1 = c1.getDeclaredConstructor(String.class,String.class) ;
```
具体代码如下：
```java
	Constructor dc1 = c1.getDeclaredConstructor(String.class,String.class) ;
	dc1.setAccessible(true);
	dc1.newInstance("小明","很帅") ;
```
`dc1.newInstance("小明","很帅");`方法调用了Person类中的：
```java
	public Person(String name, String msg) {
		this.name = name;
		this.msg = msg;
		System.out.println(name+"的描述是"+msg);
	}
```
这个构造方法，如果不传参数的话，那么调用的就是无参的构造方法。输出结果为:
```java
小明的描述是很帅
```

----------

## 通过反射了解集合泛型的本质
通过以下例子程序可以看出：
```java
package top.crosssoverjie.study;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

public class GenericEssence {
	public static void main(String[] args) {
		//声明两个list，一个有泛型，一个没有泛型
		List list1 = new ArrayList() ;
		List<String> list2 = new ArrayList<String>() ;
		
		list2.add("你好") ;
//		list2.add(11) ;加上泛型之后在编译期间只能添加String，不然会报错。
		System.out.println("list2的长度是："+list2.size());
		
		
		Class c1 = list1.getClass();
		Class c2 = list2.getClass() ;
		System.out.print("c1,c2是否相等:");
		System.out.println(c1==c2);
		
		try {
			//通过反射绕过编译器动态调用add方法，可能否加入非String类型的元素
			Method method = c2.getDeclaredMethod("add", Object.class) ;
			method.invoke(list2, 123) ;//在这里加入int类型，在上面如果加入int会出现编译报错。
			
			//list2的长度增加了，说明添加成功了
			System.out.println("现在list2的长度是:"+list2.size());
			
			/**
			 * 所以可以看出，泛型只是在编译期间起作用，在经过编译进入运行期间是不起作用的。
			 * 就算是不是泛型要求的类型也是可以插入的。
			 */
			
		} catch (Exception e) {
			e.printStackTrace() ;
		}
		
	}
}

```
> 所以可以看出，泛型只是在编译期间起作用，在经过编译进入运行期间是不起作用的。就算是不是泛型要求的类型也是可以插入的。

## 反射知识点
![泛型](http://i.imgur.com/b0yfRh9.png)

## 总结
> 泛型的应用比较多：
> - spring的IOC/DI。 
> - JDBC中的中的加载驱动

----------
# 参考
- [java中的反射机制](http://blog.csdn.net/liujiahan629629/article/details/18013523 "java中的反射机制")
- [反射机制是什么](http://zhidao.baidu.com/question/141970313.html "反射机制是什么")