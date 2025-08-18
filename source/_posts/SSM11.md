---
title: SSM(十一) 基于dubbo的分布式架构
date: 2017/04/07 01:30:54       
categories: 
- SSM
tags: 
- dubbo
- 分布式
---

![dubbo.jpg](https://ooo.0o0.ooo/2017/04/06/58e649d664665.jpg)

# 前言
现在越来越多的互联网公司还是将自己公司的项目进行服务化，这确实是今后项目开发的一个趋势，就这个点再凭借之前的`SSM`项目来让第一次接触的同学能快速上手。

# 浅谈分布式架构
`分布式架构`单看这个名字给人的感觉就是高逼格，但其实从历史的角度来分析一下就比较明了了。

> 我们拿一个电商系统来说：

## 单系统
![E65B5547-AF84-4D31-836D-72892C7AC7EA.png](https://ooo.0o0.ooo/2017/04/06/58e651937130f.png)
对于一个刚起步的创业公司项目肯定是追求越快完成功能越好，并且用户量也不大。

<!--more-->

这时候所有的业务逻辑都是在一个项目中就可以满足。

## 垂直拆分-多应用
![QQ20170406-230056@2x.jpg](https://ooo.0o0.ooo/2017/04/06/58e65856cf18a.jpg)
当业务量和用户量发展到一定地步的时候，这时一般会将应用同时部署到几台服务器上，在用户访问的时候使用`Nginx`进行反向代理和简单的负载均衡。

## SOA服务化
当整个系统以及发展的足够大的时候，比如一个电商系统中存在有：

* 用户系统
* 订单系统
* 支付系统
* 物流系统

等系统。
如果每次修改了其中一个系统就要重新发布上线的话那么耦合就太严重了。

> 所以需要将整个项目拆分成若干个独立的应用，可以进行独立的开发上线实现快速迭代。

![dubbo.png](https://ooo.0o0.ooo/2017/04/06/58e660509c5f5.png)

> 如上图所示每个应用之间相互独立,每个应用可以消费其他应用暴露出来的服务，同时也对外提供服务。

从架构的层面简单的理解了，接下来看看如何编码实现。


# 基于dubbo的实现
`dubbo`应该算是国内使用最多的分布式服务框架，基于此来实现对新入门的同学应该很有帮助。

> 其中有涉及到安装dubbo服务的注册中心zookeeper等相关知识点可以自行查看[官方文档](http://dubbo.io)，这里就不单独讲了。

## 对外提供服务
首先第一步需要在`SSM-API`模块中定义一个接口，这里就搞了一个用户查询的接口
```java
/**
 * Function:用户API
 * @author chenjiec
 * Date: 2017/4/4 下午9:46
 * @since JDK 1.7
 */
public interface UserInfoApi {

    /**
     * 获取用户信息
     * @param userId
     * @return
     * @throws Exception
     */
    public UserInfoRsp getUserInfo(int userId) throws Exception;
}
```

接着在`SSM-SERVICE`模块中进行实现：
```java
import com.alibaba.dubbo.config.annotation.Service;
/**
 * Function:
 * @author chenjiec
 * Date: 2017/4/4 下午9:51
 * @since JDK 1.7
 */
@Service
public class UserInfoApiImpl implements UserInfoApi {
    private static Logger logger = LoggerFactory.getLogger(UserInfoApiImpl.class);

    @Autowired
    private T_userService t_userService ;

    /**
     * 获取用户信息
     *
     * @param userId
     * @return
     * @throws Exception
     */
    @Override
    public UserInfoRsp getUserInfo(int userId) throws Exception {
        logger.info("用户查询Id="+userId);

        //返回对象
        UserInfoRsp userInfoRsp = new UserInfoRsp() ;
        T_user t_user = t_userService.selectByPrimaryKey(userId) ;

        //构建
        buildUserInfoRsp(userInfoRsp,t_user) ;

        return userInfoRsp;
    }


    /**
     * 构建返回
     * @param userInfoRsp
     * @param t_user
     */
    private void buildUserInfoRsp(UserInfoRsp userInfoRsp, T_user t_user) {
        if (t_user ==  null){
            t_user = new T_user() ;
        }
        CommonUtil.setLogValueModelToModel(t_user,userInfoRsp);
    }
}
```
这些都是通用的代码，但值得注意的一点是这里使用的`dubbo`框架所提供的`@service`注解。作用是声明需要暴露的服务接口。

再之后就是几个dubbo相关的配置文件了。

### spring-dubbo-config.xml
```xml
	<dubbo:application name="ssm-service" owner="crossoverJie"
		organization="ssm-crossoverJie" logger="slf4j"/>

	<dubbo:registry id="dubbo-registry" address="zookeeper://192.168.0.188:2181"
		file="/tmp/dubbo.cachr" />

	<dubbo:monitor protocol="registry" />

	<dubbo:protocol name="dubbo" port="20880" />

	<dubbo:provider timeout="15000" retries="0" delay="-1" />

	<dubbo:consumer check="false" timeout="15000" />
```
其实就是配置我们服务注册的zk地址，以及服务名称、超时时间等配置。

### spring-dubbo-provider.xml
```xml
<dubbo:annotation package="com.crossoverJie.api.impl" />
```
这个配置扫描注解包的位置，一般配置到接口实现包即可。

### spring-dubbo-consumer.xml
这个是消费者配置项，表明我们需要依赖的其他应用。
这里我们在`SSM-BOOT`项目中进行配置：
```xml
<dubbo:reference id="userInfoApi"
		interface="com.crossoverJie.api.UserInfoApi" />
```
直接就是配置的刚才我们提供的那个用户查询的接口，这样当我们自己的内部项目需要使用到这个服务只需要依赖`SSM-BOOT`即可，不需要单独的再去配置`consumer`。这个我有在上一篇[SSM(十) 项目重构-互联网项目的Maven结构](http://crossoverjie.top/2017/03/04/SSM10/#SSM-BOOT)中也有提到。

## 安装管理控制台
还有一个需要做的就是安装管理控制台，这里可以看到我们有多少服务、调用情况是怎么样等作用。

这里我们可以将dubbo的官方源码下载下来，对其中的`dubbo-admin`模块进行打包，将生成的`WAR包`放到`Tomcat`中运行起来即可。

但是需要注意一点的是：
需要将其中的`dubbo.properties`的zk地址修改为自己的即可。
```properties
dubbo.registry.address=zookeeper://127.0.0.1:2181
dubbo.admin.root.password=root
dubbo.admin.guest.password=guest
```
到时候登陆的话使用root，密码也是root。
使用guest，密码也是guest。

登陆界面如下图：
![QQ20170407-001924@2x.jpg](https://ooo.0o0.ooo/2017/04/07/58e66a9fba27d.jpg)

其中我们可以看到有两个服务以及注册上去了，但是没有消费者。

## 消费服务
为了能够更直观的体验到消费服务，我新建了一个项目：
[https://github.com/crossoverJie/SSM-CONSUMER](https://github.com/crossoverJie/SSM-CONSUMER)。

其中在`SSM-CONSUMER-API`中我也定义了一个接口：
```java
/**
 * Function:薪资API
 * @author chenjiec
 * Date: 2017/4/4 下午9:46
 * @since JDK 1.7
 */
public interface SalaryInfoApi {

    /**
     * 获取薪资
     * @param userId
     * @return
     * @throws Exception
     */
    public SalaryInfoRsp getSalaryInfo(int userId) throws Exception;
}
```
因为作为消费者的同时我们也对外提供了一个获取薪资的一个服务。

在`SSM-CONSUMER-SERVICE`模块中进行了实现：
```java
/**
 * Function:
 * @author chenjiec
 * Date: 2017/4/4 下午9:51
 * @since JDK 1.7
 */
@Service
public class SalaryInfoApiImpl implements SalaryInfoApi {
    private static Logger logger = LoggerFactory.getLogger(SalaryInfoApiImpl.class);

    @Autowired
    UserInfoApi userInfoApi ;

    /**
     * 获取用户信息
     *
     * @param userId
     * @return
     * @throws Exception
     */
    @Override
    public SalaryInfoRsp getSalaryInfo(int userId) throws Exception {
        logger.info("薪资查询Id="+userId);

        //返回对象
        SalaryInfoRsp salaryInfoRsp = new SalaryInfoRsp() ;
        
        //调用远程服务
        UserInfoRsp userInfo = userInfoApi.getUserInfo(userId);
        
        salaryInfoRsp.setUsername(userInfo.getUserName());

        return salaryInfoRsp;
    }


}
```
其中就可以直接使用`userInfoApi`调用之前的个人信息服务。

再调用之前需要注意的有点是，我们只需要依赖`SSM-BOOT`这个模块即可进行调用，因为`SSM-BOOT`模块已经为我们配置了消费者之类的操作了：
```xml
        <dependency>
            <groupId>com.crossoverJie</groupId>
            <artifactId>SSM-BOOT</artifactId>
        </dependency>
```

还有一点是在配置`SSM-BOOT`中的`spring-dubbo-cosumer.xml`配置文件的时候，路径要和我们初始化spring配置文件时的路径一致：
![QQ20170407-005850@2x.jpg](https://ooo.0o0.ooo/2017/04/07/58e67422cd592.jpg)
```xml
    <!-- Spring和mybatis的配置文件 -->
    <context-param>
        <param-name>contextConfigLocation</param-name>
        <param-value>classpath*:spring/*.xml</param-value>
    </context-param>
```

接下来跑个单测试一下能否调通：
```java
/**
 * Function:
 *
 * @author chenjiec
 *         Date: 2017/4/5 下午10:41
 * @since JDK 1.7
 */
@RunWith(SpringJUnit4ClassRunner.class)
@ContextConfiguration(locations = { "classpath*:/spring/*.xml" })
public class SalaryInfoApiImplTest {

    @Autowired
    private SalaryInfoApi salaryInfoApi ;

    @Test
    public void getSalaryInfo() throws Exception {
        SalaryInfoRsp salaryInfo = salaryInfoApi.getSalaryInfo(1);
        System.out.println(JSON.toJSONString(salaryInfo));
    }

}
```
![消费者.jpg](https://ooo.0o0.ooo/2017/04/07/58e66d2f65757.jpg)
消费者

![提供者.jpg](https://ooo.0o0.ooo/2017/04/07/58e66d318a4c5.jpg)
提供者
可以看到确实是调用成功了的。

接下来将消费者项目也同时启动在来观察管理控制台有什么不一样：
![QQ20170407-003413@2x.jpg](https://ooo.0o0.ooo/2017/04/07/58e66e4917dd1.jpg)
会看到多了一个消费者所提供的服务`com.crossoverjie.consumer.api.SalaryInfoApi`,同时
`com.crossoverJie.api.UserInfoApi`服务已经正常，说明已经有消费者了。


![QQ20170407-003456@2x.jpg](https://ooo.0o0.ooo/2017/04/07/58e66e4904d89.jpg)
点进去便可查看具体的消费者。


# 总结
这样一个基于dubbo的分布式服务已经讲的差不多了，在实际的开发中我们便会开发一个大系统中的某一个子应用，这样就算一个子应用出问题了也不会影响到整个大的项目。

再提一点：
在实际的生产环境一般同一个服务我们都会有一个`master`,`slave`的主从服务，这样在上线的过程中不至于整个应用出现无法使用的尴尬情况。

谈到了`SOA`的好处，那么自然也有相对于传统模式的不方便之处：

- 拆分一个大的项目为成百上千的子应用就不可能手动上线了，即需要自动化的部署上线，如`Jenkins`。
- 还有一个需要做到的就是监控，需要一个单独的监控平台来帮我们实时查看各个服务的运行情况以便于及时定位和解决问题。
- 日志查看分析，拆分之后不可能再去每台服务器上查看日志，需要一个单独的日志查看分析工具如`elk`。

以上就是我理解的，如有差错欢迎指正。

> 项目地址：[https://github.com/crossoverJie/SSM.git](https://github.com/crossoverJie/SSM.git)

> 个人博客地址：[http://crossoverjie.top](http://crossoverjie.top)。

> GitHub地址：[https://github.com/crossoverJie](https://github.com/crossoverJie)。







