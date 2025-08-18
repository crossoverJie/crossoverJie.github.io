---
title: 动态代理的实际应用
date: 2020/03/30 08:10:36 
categories: 
- cicada
- 动态代理
- 轮子
tags: 
- Java
- HTTP
- Netty
---

![](https://i.loli.net/2020/03/30/Rvbcd2soy3KWgAI.jpg)

# 前言

最近在用 `Python` 的 `SQLAlchemy` 库时（一个类似于 `Hibernate` 的 `ORM` 框架），发现它的 `Events` 事件还挺好用。

简单说就是当某张表的数据发生变化（曾、删、改）时会有一个事件回调，这样一些埋点之类的需求都可以实现在这里，同时和业务代码完全解耦，维护起来也很方便。

例如当订单状态发生变化需要发异步通知这样的需求也可以利用这个实现。


根据我之前使用 `Mybatis` 的经验，好像没怎么注意有这个功能，查阅了下发现 `Hibernate` 是支持的，只是我用得也少，所以也没怎么在意。

<!--more-->


>  逐渐偏离主题。。。

说这些的主要原因是我打算为之前写的 [cicada](https://github.com/TogetherOS/cicada) (轻量的 http 框架)加一个数据库操作包，也实现类似的功能。

# 示例

最终的使用效果如下：

> 第一版本还比较粗糙，但功能都具备。


![](https://i.loli.net/2020/03/30/6pZshMtufPGWECK.jpg)

第一步：需要实现一个初始化接口，该接口会在应用初始化的时候执行。

---

紧接着我们需要定义一个 `Model`：

```java
@Data
@OriginName("user")
@ToString
public class User extends Model {
    @PrimaryId
    private Integer id ;
    private String name ;
    private String password ;

    @FieldName(value = "city_id")
    private Integer cityId ;

    private String description ;

}
```

它所对应的表结构如下：

```sql
CREATE TABLE `user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) DEFAULT NULL,
  `password` varchar(100) DEFAULT NULL,
  `description` varchar(100) DEFAULT NULL,
  `roleId` int(11) DEFAULT NULL COMMENT '角色ID',
  `city_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
)
```

---

当需要查询数据时：
![](https://i.loli.net/2020/03/30/gIyDvedEM5oPGXV.jpg)
![](https://i.loli.net/2020/03/30/PeTi685t7HQpDE3.jpg)

便可以这样访问数据库。

---
当需要更新数据时：
![](https://i.loli.net/2020/03/30/Z8G5w6O3ML7EmNJ.jpg)
![](https://i.loli.net/2020/03/30/uJxo1vNPUcLIiZn.jpg)

在初始化 `DBHandle` 时指定一个回调接口(也就是这里的 `UserUpdateListener`)，便可以在修改数据的时候拿到本次修改的数据实体。

```java
@Slf4j
public class UserUpdateListener implements DataChangeListener {
    @Override
    public void listener(Object obj) {
        log.info("user update data={}", obj.toString());
    }
}
```

同时我们可以在控制台看到数据修改时的回调结果：

![](https://i.loli.net/2020/03/30/mpoH9shziTjkfW5.jpg)

这样就实现了文初所提到的功能，便可以实现一些数据变化后需要执行的业务逻辑。

# 实现

下面重点来看看这个功能的实现过程；其实通过生成 `DBHandle`（数据库增删改的接口）实例的 `API` 便可以看出些端倪。

```java
DBHandle handle = (DBHandle) new HandleProxy(DBHandle.class).getInstance(new UserSaveListener());
```

`DBHandel` 虽然是个接口，但是它并不是使用一个实现类来实现的，而是通过代理生成。

那通过代理生成比直接实例化实现类有啥好处呢？

举个例子，比如现在你想买一个新手机。

![](https://i.loli.net/2020/03/30/S34Zyn8WtpbgoiX.jpg)

第一种方式可以直接在官方旗舰店买一个标配的手机，没有额外的东西只有一个手机。

当然你也可以在某些第三方经销商那里购买带套餐的，比如`套餐一`在标配的基础上多了`保护壳、贴膜`之类的附加属性。


这个经销商就类似于我们这里的代理类，他可以在原有实现的基础上新增一些东西，至于新增什么全看你自己的需要了。

而之所以叫**动态**代理，也是因为这个代理类是在程序运行过程中动态创建的，在编译过程中并不能确定这个类的全限定名。

---
下面来看看这个代理类是如何生成的：

![](https://i.loli.net/2020/03/30/4zhFiUrMO8Iu7cl.jpg)
主要利用 `JDK` 自带的 `API` 实现的，具体参数可以直接参考官方文档：
[https://docs.oracle.com/javase/8/docs/technotes/guides/reflection/proxy.html](https://docs.oracle.com/javase/8/docs/technotes/guides/reflection/proxy.html)

总之这样便可以创建一个 `DBHandler` 接口的代理对象，而真正的代理过程是在 `InvocationHandler#invoke()` 函数中实现的：

![](https://i.loli.net/2020/03/30/finMduc76swtCN5.jpg)

这里的实现也是非常简单，在实现完代理对象的业务逻辑后便回调我们传入的事件接口，其中的参数便是当前的数据库 `Model` 实体对象。

>  不过需要注意的是，这个事件回调和业务线程是同一个，所以写在这里的逻辑建议都为异步(Hibernate 和 SQLAlchemy 都存在这个情况)。

# 总结

以上便是整个动态代理实现 `ORM` 监听机制的全过程，其实可以看出并没有它名称那样看起来高大上，当然本身实现也比较简单。

同时也不止这一种实现方式，例如:

- cglib
- javassist
- ASM 

etc..

他们的具体实现及优劣就不在本文探讨了，感兴趣的后续我会将这个功能用这几种方式实现一遍。

同时动态代理的应用也不止于此，比如：

- `RPC` 中无感知的远程调用。
- `Spring` 中的 `AOP`、拦截器等。


后续会继续完善这个 `ORM` 库，甚至可以独立出来作为一个小巧的数据库工具也未尝不可。

相关源码见此处：
[https://github.com/TogetherOS/cicada](https://github.com/TogetherOS/cicada/blob/17dc61e419dd7fb9690cfe29859c792893598c5f/cicada-example/src/main/java/top/crossoverjie/cicada/example/action/RouteAction.java#L62)


**你的点赞与分享是对我最大的支持**
