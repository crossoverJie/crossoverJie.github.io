---
title: SSM(九) 反射的实际应用 - 构建日志对象
date: 2017/1/19 03:44:54       
categories: 
- SSM
tags: 
- Java
- Reflect
---
![](https://i.loli.net/2019/05/08/5cd1b9ff04695.jpg)


# 前言
相信做Java的童鞋或多或少都听过反射，这也应该是Java从入门到进阶的必经之路。

但是在我们的实际开发中直接使用它们的几率貌似还是比较少的，（`除了造轮子或者是Spring Mybatis这些框架外`）。

所以这里介绍一个在实际开发中还是小有用处的反射实例。


# 传统日志
有关反射的一些基本知识就不说了，可以自行`Google`，也可以看下[反射入门](http://crossoverjie.top/2016/05/10/java-reflect/)。

日志相信大家都不陌生，在实际开发中一些比较敏感的数据表我们需要对它的每一次操作都记录下来。

先来看看传统的写法：
```java
    @Test
    public void insertSelective() throws Exception {

        Content content = new Content() ;
        content.setContent("asdsf");
        content.setCreatedate("2016-12-09");
        contentService.insertSelective(content) ;

        ContentLog log = new ContentLog();
        log.setContentid(content.getContentid());
        log.setContent("asdsf");
        log.setCreatedate("2016-12-09");
        contentLogService.insertSelective(log);
    }
```
非常简单，就是在保存完数据表之后再把相同的数据保存到日志表中。
<!--more-->
但是这样有以下几个问题：

- 如果数据表的字段较多的话，比如几百个。那么日志表的`setter()`方法就得写几百次，还得是都写对的情况下。
- 如果哪天数据表的字段发生了增加，那么每个写日志的地方都得增加该字段，提高了维护的成本。

针对以上的情况就得需要反射这个主角来解决了。


# 利用反射构建日志
我们先来先来看下使用反射之后对代码所带来的改变：
```java
    @Test
    public void insertSelective2() throws Exception {
        Content content = new Content();
        content.setContent("你好");
        content.setContentname("1");
        content.setCreatedate("2016-09-23");

        contentService.insertSelective(content);

        ContentLog log = new ContentLog();
        CommonUtil.setLogValueModelToModel(content, log);
        contentLogService.insertSelective(log);
    }
```
同样的保存日志，不管多少字段，只需要三行代码即可解决。
而且就算之后字段发生改变写日志这段代码仍然不需要改动。

其实这里最主要的一个方法就是`CommonUtil.setLogValueModelToModel(content, log);`

来看下是如何实现的;
```java
/**
     * 生成日志实体工具
     *
     * @param objectFrom
     * @param objectTo
     */
    public static void setLogValueModelToModel(Object objectFrom, Object objectTo) {
        Class<? extends Object> clazzFrom = objectFrom.getClass();
        Class<? extends Object> clazzTo = objectTo.getClass();

        for (Method toSetMethod : clazzTo.getMethods()) {
            String mName = toSetMethod.getName();
            if (mName.startsWith("set")) {
                //字段名
                String field = mName.substring(3);

                //获取from 值
                Object value;
                try {
                    if ("LogId".equals(field)) {
                        continue;
                    }
                    Method fromGetMethod = clazzFrom.getMethod("get" + field);
                    value = fromGetMethod.invoke(objectFrom);

                    //设置值
                    toSetMethod.invoke(objectTo, value);
                } catch (NoSuchMethodException e) {
                    throw new RuntimeException(e);
                } catch (InvocationTargetException e) {
                    throw new RuntimeException(e);
                } catch (IllegalAccessException e) {
                    throw new RuntimeException(e);
                }
            }
        }
    }
```
再使用之前我们首先需要构建好主的数据表，然后`new`一个日志表的对象。

在`setLogValueModelToModel()`方法中：

- 分别获得数据表和日志表对象的类类型。
- 获取到日志对象的所有方法集合。
- 遍历该集合，并拿到该方法的名称。
- 只取其中set开头的方法，也就是set方法。因为我们需要在循环中为日志对象的每一个字段赋值。 
- 之后截取方法名称获得具体的字段名称。
- 用之前截取的字段名称，通过`getMethod()`方法返回数据表中的该字段的`getter`方法。
- 相当于执行了`String content = content.getContent();`
- 执行该方法获得该字段具体的值。
- 利用当前循环的`setter`方法为日志对象的每一个字段赋值。
- 相当于执行了`log.setContent("asdsf");`

其中字段名称为`LogId`时跳出了当前循环，因为LogId是日志表的主键，是不需要赋值的。

当循环结束时，日志对象也就构建完成了。之后只需要保存到数据库中即可。

# 总结
反射其实是非常耗资源的，再使用过程中还是要慎用。
其中对method、field、constructor等对象做缓存也是很有必要的。

> 项目地址：[https://github.com/crossoverJie/SSM.git](https://github.com/crossoverJie/SSM.git)

> 个人博客地址：[http://crossoverjie.top](http://crossoverjie.top)。

> GitHub地址：[https://github.com/crossoverJie](https://github.com/crossoverJie)。



