---
title: 【译】Java8 之后对新开发者非常友好的特性盘点
date: 2022/02/07 08:03:13       
categories: 
- 翻译
tags: 
- Java
---


**[原文链接](https://piotrminkowski.com/2021/02/01/new-developer-friendly-features-after-java-8/)**


![](https://tva1.sinaimg.cn/large/008i3skNly1gz3vzlzrs6j30qo0f0dhz.jpg)


在这篇文章中，我将描述自 Java8 依赖对开发者来说最重要也最友好的特性，之所以选择 Java8 ，那是因为它依然是目前使用最多的版本。

具体可见这个调查报告：
![](https://tva1.sinaimg.cn/large/008i3skNly1gz3w509h16j30sg0ao74v.jpg)
<!--more-->


# Switch 表达式 (JDK 12)

使用 switch 表达式，你可以定义多个 case 条件，并使用箭头 `->` 符号返回值，这个特性在 JDK12 之后启用，它使得 switch 表达式更容易理解了。

```java
public String newMultiSwitch(int day) {
   return switch (day) {
      case 1, 2, 3, 4, 5 -> "workday";
      case 6, 7 -> "weekend";
      default -> "invalid";
   };
}
```
在 JDK12 之前，同样的例子要复杂的多：

```java
public String oldMultiSwitch(int day) {
   switch (day) {
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
         return "workday";
      case 6:
      case 7:
         return "weekend";
      default:
         return "invalid";
   }
}
```

# 文本块 (JDK 13)

文本块是一个多行字符串，可以避免使用转移字符；从 Java13 之后它成为了预览特性，使用 `"""` 符号定义。接下来看看使用它声明一个 JSON 字符串有多简单。

```java
public String getNewPrettyPrintJson() {
   return """
          {
             "firstName": "Piotr",
             "lastName": "Mińkowski"
          }
          """;
}
```

Java13 之前的版本：


```java
public String getOldPrettyPrintJson() {
   return "{\n" +
          "     \"firstName\": \"Piotr\",\n" +
          "     \"lastName\": \"Mińkowski\"\n" +
          "}";
}
```

# 新的 Optional Methods (JDK 9/ JDK 10)

Java 9/10 版本之后新增了几种可选方法，有意思的是这两个：

- `orElseThrow`
- `ifPresentOrElse`

使用 `orElseThrow` 当数据不存在时你能抛出 `NoSuchElementException` 异常，相反会返回数据。

```java
public Person getPersonById(Long id) {
   Optional<Person> personOpt = repository.findById(id);
   return personOpt.orElseThrow();
}
```

正因为如此，可以避免在 isPresent 中使用 if 条件。

```java
public Person getPersonByIdOldWay(Long id) {
   Optional<Person> personOpt = repository.findById(id);
   if (personOpt.isPresent())
      return personOpt.get();
   else
      throw new NoSuchElementException();
}
```
第二个有趣的方法是 `ifPresentOrElse` ,当数据存在时，会执行带数据参数的函数，相反会执行参数为空的函数。

```java
public void printPersonById(Long id) {
   Optional<Person> personOpt = repository.findById(id);
   personOpt.ifPresentOrElse(
      System.out::println,
      () -> System.out.println("Person not found")
   );
}
```


在 Java8 中，你需要在 isPresent 方法中使用 if else 语句。


# 集合工厂方法(JDK 9)

使用 Java9 中的集合工厂方法可以简单的使用预定义数据创建不可变集合。

```java
List<String> fruits = List.of("apple", "banana", "orange");
Map<Integer, String> numbers = Map.of(1, "one", 2,"two", 3, "three");
```

在 Java9 之前，你可以使用 Collections ，但肯定是更复杂：

```java
public List<String> fruits() {
   List<String> fruitsTmp = new ArrayList<>();
   fruitsTmp.add("apple");
   fruitsTmp.add("banana");
   fruitsTmp.add("orange");
   return Collections.unmodifiableList(fruitsTmp);
}

public Map<Integer, String> numbers() {
   Map<Integer, String> numbersTmp = new HashMap<>();
   numbersTmp.put(1, "one");
   numbersTmp.put(2, "two");
   numbersTmp.put(3, "three");
   return Collections.unmodifiableMap(numbersTmp);
}
```

# Records (JDK 14)
使用 `Records` 你可以定义一个不可变、只能访问数据（只有 getter 方法) 的类，它可以自动创建 `toString，equals，hashcode` 方法。

```java
public record Person(String name, int age) {}
```

以下效果与  `Records`  类似：
```java
public class PersonOld {

    private final String name;
    private final int age;

    public PersonOld(String name, int age) {
        this.name = name;
        this.age = age;
    }

    public String getName() {
        return name;
    }

    public int getAge() {
        return age;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PersonOld personOld = (PersonOld) o;
        return age == personOld.age && name.equals(personOld.name);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, age);
    }

    @Override
    public String toString() {
        return "PersonOld{" +
                "name='" + name + '\'' +
                ", age=" + age +
                '}';
    }
}
```



# 接口中的私有方法 (JDK 9)
从 Java8 之后你就可以为接口创建默认方法，但从 Java9 的私有方法你就能充分使用该特性：

```java
public interface ExampleInterface {
   private void printMsg(String methodName) {
      System.out.println("Calling interface");
      System.out.println("Interface method: " + methodName);
   }

   default void method1() {
      printMsg("method1");
   }

   default void method2() {
      printMsg("method2");
   }
}
```

# 局部变量类型推导 (JDK 10 / JDK 11)
从 Java10 之后你就能使用局部变量类型推导了，只需要使用 var 关键字来代替具体类型；在 Java11 之后你就能在 lambda 表达式中使用类型推导了。

```java
public String sumOfString() {
   BiFunction<String, String, String> func = (var x, var y) -> x + y;
   return func.apply("abc", "efg");
}
```