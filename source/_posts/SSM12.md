---
title: SSM(十二) dubbo日志插件
date: 2017/04/25 18:01:54       
categories: 
- SSM
tags: 
- dubbo
- 日志
---


![dubbo-filter.jpg](https://ooo.0o0.ooo/2017/04/25/58ff0b1b40d27.jpg)

# 前言
在之前[dubbo分布式框架中](http://crossoverjie.top/2017/04/07/SSM11/)讲到了如何利用dubbo来搭建一个微服务项目。其中还有一些值得优化提高开发效率的地方，比如日志：
> 当我们一个项目拆分为N多个微服务之后，当其中一个调用另一个服务出现了问题，首先第一步自然是查看日志。 

> 出现问题的有很多情况，如提供方自身代码的问题，调用方的姿势不对等。

> 自身的问题这个管不了，但是我们可以对每一个入参、返回都加上日志，这样首先就可以判断调用方是否姿势不对了。

> 为了规范日志已经后续的可扩展，我们可以单独提供一个插件给每个项目使用即可。

效果如下：

```properties
2017-04-25 15:15:38,968 DEBUG [com.alibaba.dubbo.remoting.transport.DecodeHandler] -  [DUBBO] Decode decodeable message com.alibaba.dubbo.rpc.protocol.dubbo.DecodeableRpcInvocation, dubbo version: 2.5.3, current host: 127.0.0.1
2017-04-25 15:15:39,484 DEBUG [com.crossoverJie.dubbo.filter.DubboTraceFilter] - dubbo请求数据:{"args":[1],"interfaceName":"com.crossoverJie.api.UserInfoApi","methodName":"getUserInfo"}
2017-04-25 15:15:39,484 INFO [com.crossoverJie.api.impl.UserInfoApiImpl] - 用户查询Id=1
2017-04-25 15:15:39,505 DEBUG [org.mybatis.spring.SqlSessionUtils] - Creating a new SqlSession
2017-04-25 15:15:39,525 DEBUG [org.mybatis.spring.SqlSessionUtils] - SqlSession [org.apache.ibatis.session.defaults.DefaultSqlSession@6f56b29] was not registered for synchronization because synchronization is not active
2017-04-25 15:15:39,549 DEBUG [org.mybatis.spring.transaction.SpringManagedTransaction] - JDBC Connection [com.alibaba.druid.proxy.jdbc.ConnectionProxyImpl@778b3121] will not be managed by Spring
2017-04-25 15:15:39,555 DEBUG [com.crossoverJie.api.dubbo.dao.T_userDao.selectByPrimaryKey] - ==>  Preparing: select id, username, password,roleId from t_user where id = ? 
2017-04-25 15:15:39,591 DEBUG [com.crossoverJie.api.dubbo.dao.T_userDao.selectByPrimaryKey] - ==> Parameters: 1(Integer)
2017-04-25 15:15:39,616 DEBUG [com.crossoverJie.api.dubbo.dao.T_userDao.selectByPrimaryKey] - <==      Total: 1
2017-04-25 15:15:39,616 DEBUG [com.alibaba.druid.pool.PreparedStatementPool] - {conn-10003, pstmt-20000} enter cache
2017-04-25 15:15:39,617 DEBUG [org.mybatis.spring.SqlSessionUtils] - Closing non transactional SqlSession [org.apache.ibatis.session.defaults.DefaultSqlSession@6f56b29]
2017-04-25 15:15:45,473 INFO [com.crossoverJie.dubbo.filter.DubboTraceFilter] - dubbo执行成功
2017-04-25 15:15:45,476 DEBUG [com.crossoverJie.dubbo.filter.DubboTraceFilter] - dubbo返回数据{"args":[{"id":1,"password":"123456","roleId":1,"userName":"crossoverJie"}],"interfaceName":"com.crossoverJie.api.UserInfoApi","methodName":"getUserInfo"}
```

<!--more-->

# dubbo filter拓展
参考[官方文档](http://dubbo.io/Developer+Guide-zh.htm#DeveloperGuide-zh-%E8%B0%83%E7%94%A8%E6%8B%A6%E6%88%AA%E6%89%A9%E5%B1%95)，我们可以通过```com.alibaba.dubbo.rpc.Filter```进行拓展。

## 定义实体
首先定义一个实体类用于保存调用过程中的一些数据：
```java
public class FilterDesc {

    private String interfaceName ;//接口名
    private String methodName ;//方法名
    private Object[] args ;//参数
    //省略getter setter
}

```

## DubboTraceFilter具体拦截逻辑
```java
@Activate(group = Constants.PROVIDER, order = -999)
public class DubboTraceFilter implements Filter{

    private static final Logger logger = LoggerFactory.getLogger(DubboTraceFilter.class);

    public Result invoke(Invoker<?> invoker, Invocation invocation) throws RpcException {

        try {
            FilterDesc filterReq = new FilterDesc() ;
            filterReq.setInterfaceName(invocation.getInvoker().getInterface().getName());
            filterReq.setMethodName(invocation.getMethodName()) ;
            filterReq.setArgs(invocation.getArguments());

            logger.debug("dubbo请求数据:"+JSON.toJSONString(filterReq));

            Result result = invoker.invoke(invocation);
            if (result.hasException() && invoker.getInterface() != GenericService.class){
                logger.error("dubbo执行异常",result.getException());
            }else {
                logger.info("dubbo执行成功");

                FilterDesc filterRsp = new FilterDesc() ;
                filterRsp.setMethodName(invocation.getMethodName());
                filterRsp.setInterfaceName(invocation.getInvoker().getInterface().getName());
                filterRsp.setArgs(new Object[]{result.getValue()});
                logger.debug("dubbo返回数据"+JSON.toJSONString(filterRsp));

            }
            return result ;

        }catch (RuntimeException e){
            logger.error("dubbo未知异常" + RpcContext.getContext().getRemoteHost()
                    + ". service: " + invoker.getInterface().getName() + ", method: " + invocation.getMethodName()
                    + ", exception: " + e.getClass().getName() + ": " + e.getMessage(), e);
            throw e ;
        }
    }
}
```
逻辑非常简单，只是对调用过程、异常、成功之后打印相应的日志而已。

但是有个地方要注意一下：
需要在`resource`目录下加上`META-INF.dubbo/com.alibaba.dubbo.rpc.Filter`文件。
```
dubboTraceFilter=com.crossoverJie.dubbo.filter.DubboTraceFilter
```
目录结构如下：
```
src
 |-main
    |-java
        |-com
            |-xxx
                |-XxxFilter.java (实现Filter接口)
    |-resources
        |-META-INF
            |-dubbo
                |-com.alibaba.dubbo.rpc.Filter (纯文本文件，内容为：xxx=com.xxx.XxxFilter)
```



# 总结

该项目已经托管到GitHub：
[https://github.com/crossoverJie/SSM-DUBBO-FILTER](https://github.com/crossoverJie/SSM-DUBBO-FILTER)

## 使用方法

### 安装

```
cd /SSM-DUBBO-FILTER
```

```
mvn clean
```

```
mvn install
```

### 使用

在服务提供的项目中加上依赖，这样每次调用都会打上日志。
```xml
<dependency>
    <groupId>com.crossoverJie</groupId>
    <artifactId>SSM-TRACE-FILTER</artifactId>
    <version>1.0.0</version>
</dependency>
```

**在拦截器中最好不要加上一些耗时任务，需要考虑到性能问题。**


> 项目地址：[https://github.com/crossoverJie/SSM.git](https://github.com/crossoverJie/SSM.git)

> 个人博客地址：[http://crossoverjie.top](http://crossoverjie.top)。

> GitHub地址：[https://github.com/crossoverJie](https://github.com/crossoverJie)。





