---
title: Linux（一）常用命令
date: 2016/4/10 21:01:36 
categories: 
- Linux笔记
tags: 
- Linux
---
# 前言
> 由于现在JAVA开发的很多应用都是部署到Linux系统上的，因此了解和掌握一些Linux的常用命令是非常有必要的，以下就是在Java开发过程中一些常用的命令。

----------

# 常用命令
1. 查找文件
`find / -name log.txt`
根据名称查找在 /目录下的 log.txt文件。

`find .-name "*.xml"`
递归查找所有的xml文件。

`find .-name "*.xml"|xargs grep "hello"`
递归查找所有包含hello的xml文件。

`ls -l grep 'jar'`
查找当前目录中的所有jar文件。 
<!--more-->
2. 检查一个文件是否运行
`ps –ef|grep tomecate`
检查所有有关tomcat的进程。

3. 终止线程
`kill -9 19979 `
终止线程号为19979的线程

4. 查看文件，包括隐藏文件。
`ls -al`

5. 查看当前工作目录。
`pwd`

6. 复制文件包括其子文件到指定目录
`cp -r source target`
复制source文件到target目录中。

7. 创建一个目录
`mkdir new`
创建一个new的目录

8. 删除目录(前提是此目录是空目录)
`rmdir source`
删除source目录。

9. 删除文件 包括其子文件
`rm -rf file`
删除file文件和其中的子文件。
`-r`表示向下递归，不管有多少目录一律删除
`-f`表示强制删除，不做任何提示。

10. 移动文件
`mv /temp/movefile  /target`

11. 切换用户
`su -username`

12. 查看ip
`ifconfig`
注意是 `ifconfig` 不是windows中的`ipconfig`

# 总结
以上就是在Linux下开发Java应用常用的Linux命令，如有遗漏请在评论处补充，我将不定期添加。








