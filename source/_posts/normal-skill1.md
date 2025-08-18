---
title: 日常记录（一）MySQL被锁解决方案
date: 2016/6/5 0:04:56  
categories: 
- 日常记录
tags: 
- MySQL
---
# 前言
> 由于前段时间为了让部署在Linux中的项目访问另一台服务器的MySQL，经过各种折腾就把`root`用户给弄出问题了，导致死活登不上`PS:Linux中的项目还是没有连上。。`(这是后话了。)。经过各种查阅资料终于找到解决方法了。

报错如下：
`Access denied for user 'root'@'localhost' (using password:YES)`

----------

# 关闭MySQL服务，修改MySQL初始文件
打开MySQL目录下的`my-default.ini`文件，如图：
![](http://i.imgur.com/eUDlxik.png)
在最后一行加入`skip-grant-tables`之后保存。
然后重启MySQL服务。

<!--more-->
----------
# 用命令行登录MySQL修改ROOT账号密码
用命令行登录MySQL输入`mysql -uroot -p`,不用输入密码，直接敲回车即可进入。如下图：
![](http://i.imgur.com/pENPn4Y.png)
之后执行以下语句修改ROOT用户密码：
- `use mysql;`
- `update user set password=PASSWORD("你的密码") where user='root';`

# 还原`my-default.ini`文件
最后还原配置文件，之后重启MySQL服务即可正常登录了。
![](http://i.imgur.com/rZO0ghR.png)









