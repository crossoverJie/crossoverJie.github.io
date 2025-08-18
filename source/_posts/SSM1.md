---
title: SSM(一)框架的整合
date: 2016/6/28 21:40:15    
categories: 
- SSM
tags: 
- Java
- Spring
- SpringMVC
- Mybatis
- IDEA
---

![ssmo1.jpeg](https://i.loli.net/2017/07/26/5977859dadb97.jpeg)

# 前言
最近这几年`JetBrains`公司开发的`IDEA`是越来越流行了，甚至Google的官方IDE都是`IDEA`来定制的，可见IDEA的发展趋势是越来越好，由于博主接触IDEA的时间也不长，所以有关`IDEA`和`Eclipse`的区别和优劣势请自行百度了。
借此机会我就使用IDEA来整合一下SSM，针对于初学者(初次使用IDEA和JAVAEE初学者)还是有帮助的。

----------
# 新建SSM项目
哦对了，关于IDEA的版本问题强烈建议使用旗舰版，有条件的就购买，没条件的嘛。。天朝你懂的。
在欢迎界面点击`Create New Project`。
![](http://i.imgur.com/St7JEw7.png)
<!--more-->
之后选择`Maven`(新建JAVAEE项目是需要安装JDK的，这个就不在这里讲解了。)选好之后点击下一步。
![](http://i.imgur.com/5kSWIla.png)
之后填入`GroupID`和`ArtifactID`这里尽量按照Maven的命名规范来即可。
![](http://i.imgur.com/DiiEJ4h.png)
之后点击下一步，填入项目名称，这里我建议和之前填写的`ArtifactID`名称一样即可。
![](http://i.imgur.com/aOJC4Ic.png)
点击Finish完成项目的创建。
之后尽量不要做其他操作，让IDEA完成索引创建。
![](http://i.imgur.com/rWOtgha.png)

# 完善目录结构
首先观察一下IDEA给我们生成的目录结构，这是一个标准的Maven目录。但是其中少了一个`webapp`目录用于存放`jsp`、`css`、`js`、图片之类的文件。之后还需要完善我们的目录结构，如下图：
![](http://i.imgur.com/u2xPqCS.png)
以上的命名都是我们开发过程中常用的命名规则，不一定按照我这样来，但是最好是有一定的规范。

----------

# POM.xml
`pom.xml`是整个maven的核心配置文件，里面有对项目的描述和项目所需要的依赖。哦对了，在修改`pom.xml`文件之前我们最好先设置一下该项目的Maven设置(IDEA对每个项目的maven设置和Eclipse不一样，不是设置一次就可了，如果今后还要新建项目那就还需要设置，同时按住`ctrl`,`alt`,`s`是打开设置的快捷键，更多有关IDEA的操作今后会更新相关博文。)
![](http://i.imgur.com/fCaXCDT.png)
## IDEA的Maven设置
在`Eclipse`中用过Maven的都应该知道，这里是将项目的Maven换成我们自己安装的Maven，下面两个目录是选择Maven配置文件，不知道是什么原因在`Eclipse`中选择了配置文件之后会自动的将Maven本地厂库的路径更改为你`settings.xml`中配置的路径。既然这里没有自动选中那我们就手动修改即可，尽量不要放在C盘，一是用久之后本地厂库占用的空间会比较大，二是万一系统崩溃的话还有可能找回来。
## 修改pom.xml
以下是我的`pom.xml`文件：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!--suppress MavenModelInspection -->
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.crossoverJie</groupId>
    <artifactId>SSM</artifactId>
    <version>1.0-SNAPSHOT</version>
    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <configuration>
                    <source>1.6</source>
                    <target>1.6</target>
                </configuration>
            </plugin>
        </plugins>
    </build>

    <properties>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <spring.version>4.1.4.RELEASE</spring.version>
        <jackson.version>2.5.0</jackson.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <version>3.8.1</version>
            <scope>test</scope>
        </dependency>


        <!-- spring -->
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-core</artifactId>
            <version>${spring.version}</version>
        </dependency>

        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-beans</artifactId>
            <version>${spring.version}</version>
        </dependency>

        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-context</artifactId>
            <version>${spring.version}</version>
        </dependency>

        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-tx</artifactId>
            <version>${spring.version}</version>
        </dependency>

        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-web</artifactId>
            <version>${spring.version}</version>
        </dependency>

        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-test</artifactId>
            <version>${spring.version}</version>
            <scope>test</scope>
        </dependency>

        <!-- 使用SpringMVC需配置 -->
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-webmvc</artifactId>
            <version>${spring.version}</version>
        </dependency>

        <!-- 关系型数据库整合时需配置 如hibernate jpa等 -->
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-orm</artifactId>
            <version>${spring.version}</version>
        </dependency>

        <dependency>
            <groupId>org.mybatis</groupId>
            <artifactId>mybatis-spring</artifactId>
            <version>1.2.4</version>
        </dependency>

        <!-- log4j -->
        <dependency>
            <groupId>log4j</groupId>
            <artifactId>log4j</artifactId>
            <version>1.2.17</version>
        </dependency>

        <!-- mysql连接 -->
        <dependency>
            <groupId>mysql</groupId>
            <artifactId>mysql-connector-java</artifactId>
            <version>5.1.34</version>
        </dependency>


        <dependency>
            <groupId>org.mybatis</groupId>
            <artifactId>mybatis</artifactId>
            <version>3.3.1</version>
        </dependency>

        <dependency>
            <groupId>com.alibaba</groupId>
            <artifactId>druid</artifactId>
            <version>1.0.18</version>
        </dependency>

        <!-- json -->
        <dependency>
            <groupId>com.alibaba</groupId>
            <artifactId>fastjson</artifactId>
            <version>1.2.3</version>
        </dependency>

        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-annotations</artifactId>
            <version>${jackson.version}</version>
        </dependency>

        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-core</artifactId>
            <version>${jackson.version}</version>
        </dependency>

        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
            <version>${jackson.version}</version>
        </dependency>

        <!-- aop -->
        <dependency>
            <groupId>org.aspectj</groupId>
            <artifactId>aspectjweaver</artifactId>
            <version>1.8.4</version>
        </dependency>

        <!-- servlet -->
        <dependency>
            <groupId>javax.servlet</groupId>
            <artifactId>servlet-api</artifactId>
            <version>3.0-alpha-1</version>
            <scope>provided</scope>
        </dependency>

        <dependency>
            <groupId>javax.servlet</groupId>
            <artifactId>jstl</artifactId>
            <version>1.2</version>
        </dependency>

        <dependency>
            <groupId>org.apache.commons</groupId>
            <artifactId>commons-lang3</artifactId>
            <version>3.4</version>
        </dependency>
        <!-- 上传文件 -->
        <dependency>
            <groupId>commons-fileupload</groupId>
            <artifactId>commons-fileupload</artifactId>
            <version>1.3.1</version>
        </dependency>

    </dependencies>
</project>
```
关于`maven`的知识点我就不细讲了，毕竟这是一个整合教程。


----------
# spring-mvc.xml
这个配置文件是springMVC的配置文件：
里面的我都写有注释，应该都能看懂。
```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:p="http://www.springframework.org/schema/p"
       xmlns:context="http://www.springframework.org/schema/context"
       xmlns:mvc="http://www.springframework.org/schema/mvc"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
                        http://www.springframework.org/schema/beans/spring-beans-3.1.xsd
                        http://www.springframework.org/schema/context
                        http://www.springframework.org/schema/context/spring-context-3.1.xsd
                        http://www.springframework.org/schema/mvc
                        http://www.springframework.org/schema/mvc/spring-mvc-4.0.xsd">
    <!-- 自动扫描该包，使SpringMVC认为包下用了@controller注解的类是控制器 -->
    <context:component-scan base-package="com.crossoverJie.controller" />
    <!--避免IE执行AJAX时，返回JSON出现下载文件 -->
    <!--<bean id="mappingJacksonHttpMessageConverter"
          class="org.springframework.http.converter.json.MappingJacksonHttpMessageConverter">
        <property name="supportedMediaTypes">
            <list>
                <value>text/html;charset=UTF-8</value>
            </list>
        </property>
    </bean>-->
    <mvc:annotation-driven/>
    <!-- 启动SpringMVC的注解功能，完成请求和注解POJO的映射
    -->

    <!-- 定义跳转的文件的前后缀 ，视图模式配置-->
    <bean class="org.springframework.web.servlet.view.InternalResourceViewResolver">
        <!-- 这里的配置我的理解是自动给后面action的方法return的字符串加上前缀和后缀，变成一个 可用的url地址 -->
        <property name="prefix" value="/WEB-INF/jsp/" />
        <property name="suffix" value=".jsp" />
    </bean>

    <!-- 配置文件上传，如果没有使用文件上传可以不用配置，当然如果不配，那么配置文件中也不必引入上传组件包 -->
    <bean id="multipartResolver"
          class="org.springframework.web.multipart.commons.CommonsMultipartResolver">
        <!-- 默认编码 -->
        <property name="defaultEncoding" value="utf-8" />
        <!-- 文件大小最大值 -->
        <property name="maxUploadSize" value="10485760000" />
        <!-- 内存中的最大值 -->
        <property name="maxInMemorySize" value="40960" />
    </bean>

    <!-- 配置拦截器 -->
    <!--<mvc:interceptors>
        <mvc:interceptor>
            &lt;!&ndash; <mvc:mapping path="/**"/>拦截所有 &ndash;&gt;
            <mvc:mapping path="/user/**"/>
            <mvc:mapping path="/role/**"/>
            <mvc:mapping path="/function/**"/>
            <mvc:mapping path="/news/**"/>
            <mvc:mapping path="/img/**"/>
            <bean class="com.crossoverJie.intercept.Intercept"></bean>
        </mvc:interceptor>
    </mvc:interceptors>-->

</beans>
```
关于上面拦截器注释掉的那里，配置是没有问题的，因为这是一个整合项目，所以里边也没有用到拦截器，为了防止运行报错所以就先注释掉了。如果后续需要增加拦截器，可以参考这里的配置。

----------
# spring-mybatis.xml
这个是spring和mybatis的整合配置文件，其中还有`Druid`连接池的配置。
```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:context="http://www.springframework.org/schema/context"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
                        http://www.springframework.org/schema/beans/spring-beans-3.1.xsd
                        http://www.springframework.org/schema/context
                        http://www.springframework.org/schema/context/spring-context-3.1.xsd">
    <!-- 自动扫描 -->
    <context:component-scan base-package="com.crossoverJie" />
    <!-- 引入配置文件 -->
    <bean id="propertyConfigurer"
          class="org.springframework.beans.factory.config.PropertyPlaceholderConfigurer">
        <property name="location" value="classpath:jdbc.properties" />
    </bean>

    <bean id="dataSource" class="com.alibaba.druid.pool.DruidDataSource"
          init-method="init" destroy-method="close">
        <!-- 指定连接数据库的驱动 -->
        <property name="driverClassName" value="${jdbc.driverClass}" />
        <property name="url" value="${jdbc.url}" />
        <property name="username" value="${jdbc.user}" />
        <property name="password" value="${jdbc.password}" />

        <!-- 配置初始化大小、最小、最大 -->
        <property name="initialSize" value="3" />
        <property name="minIdle" value="3" />
        <property name="maxActive" value="20" />

        <!-- 配置获取连接等待超时的时间 -->
        <property name="maxWait" value="60000" />

        <!-- 配置间隔多久才进行一次检测，检测需要关闭的空闲连接，单位是毫秒 -->
        <property name="timeBetweenEvictionRunsMillis" value="60000" />

        <!-- 配置一个连接在池中最小生存的时间，单位是毫秒 -->
        <property name="minEvictableIdleTimeMillis" value="300000" />

        <property name="validationQuery" value="SELECT 'x'" />
        <property name="testWhileIdle" value="true" />
        <property name="testOnBorrow" value="false" />
        <property name="testOnReturn" value="false" />

        <!-- 打开PSCache，并且指定每个连接上PSCache的大小 -->
        <property name="poolPreparedStatements" value="true" />
        <property name="maxPoolPreparedStatementPerConnectionSize"
                  value="20" />

        <!-- 配置监控统计拦截的filters，去掉后监控界面sql无法统计 -->
        <property name="filters" value="stat" />
    </bean>

    <!-- spring和MyBatis完美整合，不需要mybatis的配置映射文件 -->
    <bean id="sqlSessionFactory" class="org.mybatis.spring.SqlSessionFactoryBean">
        <property name="dataSource" ref="dataSource" />
        <!-- 自动扫描mapping.xml文件 -->
        <property name="mapperLocations" value="classpath:mapping/*.xml"></property>
    </bean>

    <!-- DAO接口所在包名，Spring会自动查找其下的类 -->
    <bean class="org.mybatis.spring.mapper.MapperScannerConfigurer">
        <property name="basePackage" value="com.crossoverJie.dao" />
        <property name="sqlSessionFactoryBeanName" value="sqlSessionFactory"></property>
    </bean>

    <!-- (事务管理)transaction manager, use JtaTransactionManager for global tx -->
    <bean id="transactionManager"
          class="org.springframework.jdbc.datasource.DataSourceTransactionManager">
        <property name="dataSource" ref="dataSource" />
    </bean>

</beans>
```
以上两个就是最重要的配置文件了，只要其中的包名和配置文件中的名字一样就不会出问题。
关于`xxMpper.xml`以及实体类的生成，我们可以借助`mybatis-generator`自动生成工具来生成，方便快捷。

----------
# IDEA配置Tomcat
关于Tomcat的下载与安装我这里就不多介绍了。
![](http://i.imgur.com/vJPS2Yh.png)
按照下图选择：
![](http://i.imgur.com/FH695fj.png)
在`name`中为这个Tomcat输入一个名字。之后选择你本地Tomcat的目录点击`Ok`即可。
![](http://i.imgur.com/f1RS3LJ.png)
![](http://i.imgur.com/gKKK6YG.png)
![](http://i.imgur.com/7jjk7JF.png)
点击`apply`和保存之后就返回首页即可看到Tomcat的标识。
![](http://i.imgur.com/9Zw2ngh.png)
根据需要点击`Run`和`Debug`即可运行。

运行结果如下：
![](http://i.imgur.com/zJgW4za.png)
![](http://i.imgur.com/q8zyEJk.png)
点击上图的2,3,4可看到不同用户的结果，如果你走到这一步，那么恭喜你整合成功。

----------
# 总结

以上源码都在github上。
项目地址：[SSM](https://github.com/crossoverJie/SSM.git)
欢迎拍砖。
