---
title: SSM(七)在JavaWeb应用中使用Redis
date: 2016/12/18 13:44:54       
categories: 
- SSM
tags: 
- Java
- Redis
---
![redis封面.jpg](https://ooo.0o0.ooo/2017/05/07/590ea75de0d84.jpg)


# 前言

由于最近换(mang)了(de)家(yi)公(bi)司接触了新的东西所以很久没有更新了。
这次谈谈Redis，关于`Redis`应该很多朋友就算没有用过也听过，算是这几年最流行的`NoSql`之一了。
`Redis`的应用场景非常多这里就不一一列举了，这次就以一个最简单的也最常用的 **缓存数据** 来举例。
先来看一张效果图：

![](https://i.loli.net/2019/05/08/5cd1ba0ab8f76.jpg)

<!--more-->
作用就是在每次查询接口的时候首先判断`Redis`中是否有缓存，有的话就读取，没有就查询数据库并保存到`Redis`中，下次再查询的话就会直接从缓存中读取了。
`Redis`中的结果：

![](https://i.loli.net/2019/05/08/5cd1ba0d7badf.jpg)

之后查询redis发现确实是存进来了。


# Redis安装与使用
首先第一步自然是安装`Redis`。我是在我`VPS`上进行安装的，操作系统是`CentOS6.5`。
- 下载Redis[https://redis.io/download](https://redis.io/download)，我机器上安装的是`3.2.5`

- 将下载下来的'reidis-3.2.5-tar.gz'上传到`usr/local`这个目录进行解压。

- 进入该目录。

![](https://i.loli.net/2019/05/08/5cd1ba12c0bb0.jpg)

-  编译安装
```linux
make
make install
```

- 修改`redis.conf`配置文件。

这里我只是简单的加上密码而已。
```linux
vi redis.conf
requirepass 你的密码
```
- 启动Redis

启动时候要选择我们之前修改的配置文件才能使配置文件生效。
```linux
进入src目录
cd /usr/local/redis-3.2.5/src
启动服务
./redis-server ../redis.conf
```

- 登陆redis
```linux
./redis-cli -a 你的密码
```

# Spring整合Redis
这里我就直接开始用Spring整合毕竟在实际使用中都是和`Spring`一起使用的。

- 修改`Spring`配置文件
加入以下内容：
```xml
<!-- jedis 配置 -->
    <bean id="poolConfig" class="redis.clients.jedis.JedisPoolConfig">
        <property name="maxIdle" value="${redis.maxIdle}"/>
        <property name="maxWaitMillis" value="${redis.maxWait}"/>
        <property name="testOnBorrow" value="${redis.testOnBorrow}"/>
    </bean>
    <!-- redis服务器中心 -->
    <bean id="connectionFactory" class="org.springframework.data.redis.connection.jedis.JedisConnectionFactory">
        <property name="poolConfig" ref="poolConfig"/>
        <property name="port" value="${redis.port}"/>
        <property name="hostName" value="${redis.host}"/>
        <property name="password" value="${redis.password}"/>
        <property name="timeout" value="${redis.timeout}"></property>
    </bean>
    <bean id="redisTemplate" class="org.springframework.data.redis.core.RedisTemplate">
        <property name="connectionFactory" ref="connectionFactory"/>
        <property name="keySerializer">
            <bean class="org.springframework.data.redis.serializer.StringRedisSerializer"/>
        </property>
        <property name="valueSerializer">
            <bean class="org.springframework.data.redis.serializer.JdkSerializationRedisSerializer"/>
        </property>
    </bean>

    <!-- cache配置 -->
    <bean id="methodCacheInterceptor" class="com.crossoverJie.intercept.MethodCacheInterceptor">
        <property name="redisUtil" ref="redisUtil"/>
    </bean>
    <bean id="redisUtil" class="com.crossoverJie.util.RedisUtil">
        <property name="redisTemplate" ref="redisTemplate"/>
    </bean>

    <!--配置切面拦截方法 -->
    <aop:config proxy-target-class="true">
        <!--将com.crossoverJie.service包下的所有select开头的方法加入拦截
        去掉select则加入所有方法w
        -->
        <aop:pointcut id="controllerMethodPointcut" expression="
        execution(* com.crossoverJie.service.*.select*(..))"/>

        <aop:pointcut id="selectMethodPointcut" expression="
        execution(* com.crossoverJie.dao..*Mapper.select*(..))"/>

        <aop:advisor advice-ref="methodCacheInterceptor" pointcut-ref="controllerMethodPointcut"/>
    </aop:config>
``` 
更多的配置可以直接在源码里面查看：[https://github.com/crossoverJie/SSM/blob/master/src/main/resources/spring-mybatis.xml](https://github.com/crossoverJie/SSM/blob/master/src/main/resources/spring-mybatis.xml)。
以上都写有注释，也都是一些简单的配置相信都能看懂。
下面我会着重说下如何配置缓存的。

# Spring切面使用缓存
Spring的`AOP`真是是一个好东西，还不太清楚是什么的同学建议先自行`Google`下吧。
在不使用切面的时候如果我们想给某个方法加入缓存的话肯定是在方法返回之前就要加入相应的逻辑判断，只有一个或几个倒还好，如果有几十上百个的话那GG了，而且维护起来也特别麻烦。
> 好在Spring的AOP可以帮我们解决这个问题。
> 这次就在我们需要加入缓存方法的切面加入这个逻辑，并且只需要一个配置即可搞定，就是上文中所提到的配置文件，如下：

```xml
    <!--配置切面拦截方法 -->
    <aop:config proxy-target-class="true">
        <!--将com.crossoverJie.service包下的所有select开头的方法加入拦截
        去掉select则加入所有方法w
        -->
        <aop:pointcut id="controllerMethodPointcut" expression="
        execution(* com.crossoverJie.service.*.select*(..))"/>

        <aop:pointcut id="selectMethodPointcut" expression="
        execution(* com.crossoverJie.dao..*Mapper.select*(..))"/>

        <aop:advisor advice-ref="methodCacheInterceptor" pointcut-ref="controllerMethodPointcut"/>
    </aop:config>
```
这里我们使用表达式`execution(* com.crossoverJie.service.*.select*(..))`来拦截`service`中所有以`select`开头的方法。这样只要我们要将加入的缓存的方法以select命名开头的话每次进入方法之前都会进入我们自定义的`MethodCacheInterceptor`拦截器。
这里贴一下`MethodCacheInterceptor`中处理逻辑的核心方法：
```java
@Override
    public Object invoke(MethodInvocation invocation) throws Throwable {
        Object value = null;

        String targetName = invocation.getThis().getClass().getName();
        String methodName = invocation.getMethod().getName();
        // 不需要缓存的内容
        //if (!isAddCache(StringUtil.subStrForLastDot(targetName), methodName)) {
        if (!isAddCache(targetName, methodName)) {
            // 执行方法返回结果
            return invocation.proceed();
        }
        Object[] arguments = invocation.getArguments();
        String key = getCacheKey(targetName, methodName, arguments);
        logger.debug("redisKey: " + key);
        try {
            // 判断是否有缓存
            if (redisUtil.exists(key)) {
                return redisUtil.get(key);
            }
            // 写入缓存
            value = invocation.proceed();
            if (value != null) {
                final String tkey = key;
                final Object tvalue = value;
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        if (tkey.startsWith("com.service.impl.xxxRecordManager")) {
                            redisUtil.set(tkey, tvalue, xxxRecordManagerTime);
                        } else if (tkey.startsWith("com.service.impl.xxxSetRecordManager")) {
                            redisUtil.set(tkey, tvalue, xxxSetRecordManagerTime);
                        } else {
                            redisUtil.set(tkey, tvalue, defaultCacheExpireTime);
                        }
                    }
                }).start();
            }
        } catch (Exception e) {
            e.printStackTrace();
            if (value == null) {
                return invocation.proceed();
            }
        }
        return value;
    }
```
- 先是查看了当前方法是否在我们自定义的方法中，如果不是的话就直接返回，不进入拦截器。
- 之后利用反射获取的类名、方法名、参数生成`redis`的`key`。
- 用key在redis中查询是否已经有缓存。
- 有缓存就直接返回缓存内容，不再继续查询数据库。
- 如果没有缓存就查询数据库并将返回信息加入到redis中。

## 使用PageHelper
这次为了分页方便使用了比较流行的`PageHelper`来帮我们更简单的进行分页。
首先是新增一个mybatis的配置文件`mybatis-config`：
```xml
<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE configuration
        PUBLIC "-//mybatis.org//DTD Config 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-config.dtd">
<configuration>
    <settings>
        <setting name="cacheEnabled" value="true"/>
        <setting name="lazyLoadingEnabled" value="true"/>
        <setting name="multipleResultSetsEnabled" value="true"/>
        <setting name="useColumnLabel" value="true"/>
        <setting name="useGeneratedKeys" value="false"/>
        <setting name="autoMappingBehavior" value="PARTIAL"/>
        <setting name="defaultExecutorType" value="SIMPLE"/>
        <setting name="defaultStatementTimeout" value="25"/>
        <setting name="safeRowBoundsEnabled" value="false"/>
        <setting name="mapUnderscoreToCamelCase" value="false"/>
        <setting name="localCacheScope" value="SESSION"/>
        <setting name="jdbcTypeForNull" value="OTHER"/>
        <setting name="lazyLoadTriggerMethods" value="equals,clone,hashCode,toString"/>
    </settings>

    <plugins>
        <!-- com.github.pagehelper为PageHelper类所在包名 -->
        <plugin interceptor="com.github.pagehelper.PageHelper">
            <property name="dialect" value="mysql"/>
            <!-- 该参数默认为false -->
            <!-- 设置为true时，会将RowBounds第一个参数offset当成pageNum页码使用 -->
            <!-- 和startPage中的pageNum效果一样 -->
            <property name="offsetAsPageNum" value="true"/>
            <!-- 该参数默认为false -->
            <!-- 设置为true时，使用RowBounds分页会进行count查询 -->
            <property name="rowBoundsWithCount" value="true"/>

            <!-- 设置为true时，如果pageSize=0或者RowBounds.limit = 0就会查询出全部的结果 -->
            <!-- （相当于没有执行分页查询，但是返回结果仍然是Page类型） <property name="pageSizeZero" value="true"/> -->

            <!-- 3.3.0版本可用 - 分页参数合理化，默认false禁用 -->
            <!-- 启用合理化时，如果pageNum<1会查询第一页，如果pageNum>pages会查询最后一页 -->
            <!-- 禁用合理化时，如果pageNum<1或pageNum>pages会返回空数据 -->
            <property name="reasonable" value="true"/>
            <!-- 3.5.0版本可用 - 为了支持startPage(Object params)方法 -->
            <!-- 增加了一个`params`参数来配置参数映射，用于从Map或ServletRequest中取值 -->
            <!-- 可以配置pageNum,pageSize,count,pageSizeZero,reasonable,不配置映射的用默认值 -->
            <!-- 不理解该含义的前提下，不要随便复制该配置 -->
            <property name="params" value="pageNum=start;pageSize=limit;"/>
        </plugin>
    </plugins>
</configuration>
```
接着在mybatis的配置文件中引入次配置文件：
```xml
    <bean id="sqlSessionFactory" class="org.mybatis.spring.SqlSessionFactoryBean">
        <property name="dataSource" ref="dataSource" />
        <!-- 自动扫描mapping.xml文件 -->
        <property name="mapperLocations" value="classpath:mapping/*.xml"></property>
        <!--加入PageHelper-->
        <property name="configLocation" value="classpath:mybatis-config.xml"/>
    </bean>
```
接着在service方法中：
```java
    @Override
    public PageEntity<Rediscontent> selectByPage(Integer pageNum, Integer pageSize) {
        PageHelper.startPage(pageNum, pageSize);
        //因为是demo，所以这里默认没有查询条件。
        List<Rediscontent> rediscontents = rediscontentMapper.selectByExample(new RediscontentExample());
        PageEntity<Rediscontent> rediscontentPageEntity = new PageEntity<Rediscontent>();
        rediscontentPageEntity.setList(rediscontents);
        int size = rediscontentMapper.selectByExample(new RediscontentExample()).size();
        rediscontentPageEntity.setCount(size);
        return rediscontentPageEntity;
    }
```
只需要使用`PageHelper.startPage(pageNum, pageSize);`方法就可以帮我们简单的分页了。
这里我自定义了一个分页工具类`PageEntity`来更方便的帮我们在之后生成`JSON`数据。
```java
package com.crossoverJie.util;

import java.io.Serializable;
import java.util.List;

/**
 * 分页实体
 *
 * @param <T>
 */
public class PageEntity<T> implements Serializable {
    private List<T> list;// 分页后的数据
    private Integer count;

    public Integer getCount() {
        return count;
    }

    public void setCount(Integer count) {
        this.count = count;
    }

    public List<T> getList() {
        return list;
    }

    public void setList(List<T> list) {
        this.list = list;
    }
}
```
更多`PageHelper`的使用请查看一下链接：
[https://github.com/pagehelper/Mybatis-PageHelper](https://github.com/pagehelper/Mybatis-PageHelper)


# 前端联调
接下来看下控制层`RedisController`:
```java
package com.crossoverJie.controller;

import com.crossoverJie.pojo.Rediscontent;
import com.crossoverJie.service.RediscontentService;
import com.crossoverJie.util.CommonUtil;
import com.crossoverJie.util.PageEntity;
import com.github.pagehelper.PageHelper;
import net.sf.json.JSONArray;
import net.sf.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import javax.servlet.http.HttpServletResponse;


@Controller
@RequestMapping("/redis")
public class RedisController {

    private static Logger logger = LoggerFactory.getLogger(RedisController.class);

    @Autowired
    private RediscontentService rediscontentService;


    @RequestMapping("/redis_list")
    public void club_list(HttpServletResponse response,
                          @RequestParam(value = "page", defaultValue = "0") int page,
                          @RequestParam(value = "pageSize", defaultValue = "0") int pageSize) {
        JSONObject jsonObject = new JSONObject();
        JSONObject jo = new JSONObject();
        try {
            JSONArray ja = new JSONArray();
            PageHelper.startPage(1, 10);
            PageEntity<Rediscontent> rediscontentPageEntity = rediscontentService.selectByPage(page, pageSize);
            for (Rediscontent rediscontent : rediscontentPageEntity.getList()) {
                JSONObject jo1 = new JSONObject();
                jo1.put("rediscontent", rediscontent);
                ja.add(jo1);
            }
            jo.put("redisContents", ja);
            jo.put("count", rediscontentPageEntity.getCount());
            jsonObject = CommonUtil.parseJson("1", "成功", jo);

        } catch (Exception e) {
            jsonObject = CommonUtil.parseJson("2", "操作异常", "");
            logger.error(e.getMessage(), e);
        }
        //构建返回
        CommonUtil.responseBuildJson(response, jsonObject);
    }
}
```
这里就不做过多解释了，就是从redis或者是service中查询出数据并返回。

前端的显示界面在[https://github.com/crossoverJie/SSM/blob/master/src/main/webapp/redis/showRedis.jsp](https://github.com/crossoverJie/SSM/blob/master/src/main/webapp/redis/showRedis.jsp)中(并不是前端，将就看)。
其中核心的`redis_list.js`的代码如下：
```js
var page = 1,
    rows = 10;
$(document).ready(function () {
    initJqPaginator();
    //加载
    load_redis_list();
    $(".query_but").click(function () {//查询按钮
        page = 1;
        load_redis_list();
    });
});
//初始化分页
function initJqPaginator() {
    $.jqPaginator('#pagination', {
        totalPages: 100,
        visiblePages: 10,
        currentPage: 1,
        first: '<li class="prev"><a href="javascript:;">首页</a></li>',
        last: '<li class="prev"><a href="javascript:;">末页</a></li>',
        prev: '<li class="prev"><a href="javascript:;">上一页</a></li>',
        next: '<li class="next"><a href="javascript:;">下一页</a></li>',
        page: '<li class="page"><a href="javascript:;">{{page}}</a></li>',
        onPageChange: function (num, type) {
            page = num;
            if (type == "change") {
                load_redis_list();
            }
        }
    });
}
//列表
function create_club_list(redisContens) {
    var phone = 0;
    var html = '<div class="product_box">'
        + '<div class="br">'
        + '<div class="product_link">'
        + '<div class="product_phc">'
        + '<img class="phc" src="" >'
        + '</div>'
        + '<span class="product_name">' + redisContens.id + '</span></div>'
        + '<div class="product_link toto">' + redisContens.content + '</div>'
        + '<div class="product_link toto">'
        + '<span>' + "" + '</span>'
        + '</div>'
        + '<div class="product_link toto">'
        + '<span>' + phone + '</span></div>'
        + '<div class="product_link toto">'
        + '<span>' + 0 + '</span></div>'
        + '<div class="product_link toto product_operation">'
        + '<span onclick="edit_club(' + 0 + ')">编辑</span>'
        + '<span onclick="edit_del(' + 0 + ')">删除</span></div></div>'
        + '</div>';
    return html;
}
//加载列表
function load_redis_list() {
    var name = $("#name").val();
    $.ajax({
        type: 'POST',
        url: getPath() + '/redis/redis_list',
        async: false,
        data: {name: name, page: page, pageSize: rows},
        datatype: 'json',
        success: function (data) {
            if (data.result == 1) {
                $(".product_length_number").html(data.data.count);
                var html = "";
                var count = data.data.count;
                for (var i = 0; i < data.data.redisContents.length; i++) {
                    var redisContent = data.data.redisContents[i];
                    html += create_club_list(redisContent.rediscontent);
                }
                $(".product_content").html(html);
                //这里是分页的插件
                $('#pagination').jqPaginator('option', {
                    totalPages: (Math.ceil(count / rows) < 1 ? 1 : Math.ceil(count / rows)),
                    currentPage: page
                });
            } else {
                alert(data.msg);
            }
        }
    });
    $(".product_box:even").css("background", "#e6e6e6");//隔行变色
}
```
其实就是一个简单的请求接口，并根据返回数据动态生成`Dom`而已。

# 总结
以上就是一个简单的`redis`的应用。
redis的应用场景还非常的多，比如现在我所在做的一个项目就有用来处理短信验证码的业务场景，之后有时间可以写一个demo。

> 项目地址：[https://github.com/crossoverJie/SSM.git](https://github.com/crossoverJie/SSM.git)
> GitHub地址：[https://github.com/crossoverJie](https://github.com/crossoverJie)。

