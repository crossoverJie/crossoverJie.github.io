---
title: Linux（二）服务器运行环境配置
date: 2016/9/20 19:45:17  
categories: 
- Linux笔记
tags: 
- Linux 
- centos 
- nginx
---

![linux2.jpg](https://ooo.0o0.ooo/2017/05/07/590ea8312b227.jpg)

# 前言
Linux相信对大多数程序员来说都不陌生，毕竟在服务器端依然还是霸主地位而且丝毫没有退居二线的意思，以至于现在几乎每一个软件开发的相关人员都得或多或少的知道一些Linux的相关内容，本文将介绍如何在刚拿到一台云服务器(采用`centos`)来进行运行环境的搭建，包括`JDK`、`Mysql`、`Tomcat`以及`nginx`。相信对于小白来说很有必要的，也是我个人的一个记录。
> 该服务器的用途是用于部署JavaEE项目。
部署之后的效果图如下:
![mac背景.jpg](https://ooo.0o0.ooo/2017/05/07/590ea878f1a8b.jpg)
<!--more-->

# JDK安装
由于我们之后需要部署的是`JavaEE`项目，所以首先第一步就是安装JDK了。
## 卸载自带的openJDK
现在的服务器拿来之后一般都是默认给我们安装一个`openJDK`，首先我们需要卸载掉。
 1. 使用`rpm -qa | grep java`命令查看系统中是否存在有Java。
 2. 使用`rpm -e --nodeps 相关应用名称`来进行卸载。(相关应用名称就是上一个命令中显示出来的名称复制到这里卸载即可)。

## 下载并安装JDK

 1. 之后是下载`ORACLE`所提供的JDK，[传送门](http://www.oracle.com/technetwork/java/javase/downloads/jdk8-downloads-2133151.html)根据自己系统的情况下载对应版本即可。笔者使用的是`jdk-8u101-linux-x64.rpm`版本。
 2. 然后使用FTP工具上传到`/usr/java`目录下即可，没有`java`目录新建一个即可。
 3. 然后使用`rpm -ivh jdk-8u101-linux-x64.rpm`命令进行解压安装。

## profile文件配置
安装完成之后使用`vi /etc/profile`命令编辑`profile`文件(注意该文件路径是指根目录下的etc文件夹不要找错了)。
在该文件中加入以下内容：
```shell
export JAVA_HOME=/usr/java/jdk-8u101-linux-x64
export CLASSPATH=.:$JAVA_HOME/jre/lib/rt.jar:$JAVA_HOME/lib/dt.jar:$JAVA_HOME/lib/tools.jar
export PATH=$PATH:$JAVA_HOME/bin
```
保存之后运行`source /etc/profile`使配置生效。

## 验证是否安装成功
之后我们使用在`windows`平台也有的命令`java -version`，如果输出如图：
![2](http://img.blog.csdn.net/20160920000008974)
表示安装成功。

# MySQL安装
## 卸载自带的Mysql
首先第一步还是要卸载掉自带的mysql。
`rpm -e --nodeps mysql`命令和之前一样只是把应用名称换成mysql了而已。

## 使用`yum`来安装mysql
之后我们采用`yum`来安装mysql。这样的方式最简单便捷。
`yum install -y mysql-server mysql mysql-deve`执行该命令直到出现`Complete!`提示之后表示安装成功。
`rpm -qi mysql-server`之后使用该命令可以查看我们安装的mysql信息。

## mysql相关配置
使用`service mysqld start`来启动mysql服务(第一次会输出很多信息)，之后就不会了。
然后我们可以使用`chkconfig mysqld on`命令将mysql设置为开机启动。
输入`chkconfig --list | grep mysql`命令显示如下图：
![3](http://img.blog.csdn.net/20160920120817031)
表示设置成功。
使用`mysqladmin -u root password 'root'`为`root`账户设置密码。

## 设置远程使用
```
grant all privileges on *.* to 'root'@'%' identified by '123456' with grant option;
# root是用户名，%代表任意主机，'123456'指定的登录密码（这个和本地的root密码可以设置不同的，互不影响）
flush privileges; # 重载系统权限
exit;
```

## 验证使用
使用`mysql -u root -proot`来登录mysql。如果出现以下界面表示设置成功。
![4](http://img.blog.csdn.net/20160920121542492)

# Tomcat安装
`Tomcat`也是我们运行`JavaEE`项目必备的一个中间件。
1. 第一步需要下载linux的Tomcat，[传送门](http://tomcat.apache.org/download-80.cgi)。根据自己系统版本进行下载即可。之后将`apache-tomcat-8.5.5.tar.gz`上传到`/usr/local`目录中。
2. 解压该压缩包`tar -zxv -f apache-tomcat-8.5.5.tar.gz`,再使用`mv apache-tomcat-8.5.5  tomcat`将解压的Tomcat移动到外层的`Tomcat`目录中。
3. 进入`/usr/local/tomcat/apache-tomcat-8.5.5/bin`目录使用`./startup.bat`命令启动tomcat。
4. 因为tomcat使用的默认端口是`8080`，linux防火墙默认是不能访问的，需要手动将其打开。使用`vi + /etc/sysconfig/iptables`编辑`iptables`(注意etc目录是根目录下的)，加入以下代码:
```shell
-A RH-Firewall-1-INPUT -m state --state NEW -m tcp -p tcp --dport 8080 -j ACCEPT
-A RH-Firewall-1-INPUT -m state --state NEW -m tcp -p tcp --dport 80 -j ACCEPT
```
这里我们开放了8080和80端口，之后安装nginx就不用在开放了。
> ps:这里用到了简单的vim命令。按`i`进入插入模式，输入上面两段代码。之后按`esc`退出插入模式。再按`:wq`保存关闭即可。
之后使用`service iptables restart`命令重启防火墙即可。在浏览器输入服务器的`ip+8080`如果出现Tomcat的欢迎页即表明`Tomcat`安装成功。

# nginx安装
最后是安装`nginx`，这里我们还是使用最简单的`yum`的方式来进行安装。

 - 首先使用以下几个命令安装必备的几个库：
```shell
yum -y install pcre*
yum -y install openssl*
yum -y install gcc
```
 - 之后安装nginx。
```shell
 cd /usr/local/
 wget http://nginx.org/download/nginx-1.4.2.tar.gz
 tar -zxvf nginx-1.4.2.tar.gz
 cd nginx-1.4.2  
 ./configure --prefix=/usr/local/nginx --with-http_stub_status_module
 make
 make install
```
- 之后就可以使用`/usr/local/nginx/sbin/nginx`命令来启动nginx了。输入服务器的IP地址，如果出现nginx的欢迎界面表示安装成功了。

## nginx配置
这里我就简单贴以下我的配置，主要就是配置一个`upstream,`之后在`server`中引用配置的那个`upstream`即可。
```conf

#user  nobody;
worker_processes  1;

#error_log  logs/error.log;
#error_log  logs/error.log  notice;
#error_log  logs/error.log  info;

#pid        logs/nginx.pid;


events {
    worker_connections  1024;
}


http {
    include       mime.types;
    default_type  application/octet-stream;

    #log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
    #                  '$status $body_bytes_sent "$http_referer" '
    #                  '"$http_user_agent" "$http_x_forwarded_for"';

    #access_log  logs/access.log  main;

    sendfile        on;
    #tcp_nopush     on;

    #keepalive_timeout  0;
    keepalive_timeout  65;

    #gzip  on;

    upstream crossover_main {
        server 127.0.0.1:8080;
    }

    server {
        listen       80;
        server_name  www.crossoverjie.top;

        #charset koi8-r;

        #access_log  logs/host.access.log  main;

        location  / {
             proxy_pass http://crossover_main/examples/;
             proxy_set_header Host $http_host;
             proxy_set_header X-Forwarded-For $remote_addr;
             index  index.jsp;
        }


        #error_page  404              /404.html;

        # redirect server error pages to the static page /50x.html
        #
        error_page   500 502 503 504  /50x.html;
        location = /50x.html {
            root   html;
        }

        # proxy the PHP scripts to Apache listening on 127.0.0.1:80
        #
        #location ~ \.php$ {
        #    proxy_pass   http://127.0.0.1;
        #}

        # pass the PHP scripts to FastCGI server listening on 127.0.0.1:9000
        #
        #location ~ \.php$ {
        #    root           html;
        #    fastcgi_pass   127.0.0.1:9000;
        #    fastcgi_index  index.php;
        #    fastcgi_param  SCRIPT_FILENAME  /scripts$fastcgi_script_name;
        #    include        fastcgi_params;
        #}

        # deny access to .htaccess files, if Apache's document root
        # concurs with nginx's one
        #
        #location ~ /\.ht {
        #    deny  all;
        #}
    }


    # another virtual host using mix of IP-, name-, and port-based configuration
    #
    #server {
    #    listen       8000;
    #    listen       somename:8080;
    #    server_name  somename  alias  another.alias;

    #    location / {
    #        root   html;
    #        index  index.html index.htm;
    #    }
    #}


    # HTTPS server
    #
    #server {
    #    listen       443;
    #    server_name  localhost;

    #    ssl                  on;
    #    ssl_certificate      cert.pem;
    #    ssl_certificate_key  cert.key;

    #    ssl_session_timeout  5m;

    #    ssl_protocols  SSLv2 SSLv3 TLSv1;
    #    ssl_ciphers  HIGH:!aNULL:!MD5;
    #    ssl_prefer_server_ciphers   on;

    #    location / {
    #        root   html;
    #        index  index.html index.htm;
    #    }
    #}

}
```
之后我们在地址栏输入服务器的IP地址(如果有域名解析了服务器的IP可以直接输入域名)就会进入我们在`upstream`中配置的地址加上在`server`中的地址。根据我这里的配置最后解析地址就是`http://127.0.0.1:8080/examples`应该是很好理解的。最终的结果是我在片头放的那张截图一样。

# 总结
这是一个简单的基于centOS的运行环境配置，对于小白练手应该是够了，有不清楚和错误的地方欢迎指出反正我也不会回复。
![4](http://i.imgur.com/wQmHabT.gif)

> 个人博客地址：[http://crossoverjie.top](http://crossoverjie.top)。

> GitHub地址：[https://github.com/crossoverJie](https://github.com/crossoverJie)。










