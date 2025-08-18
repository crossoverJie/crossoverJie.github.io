---
title: 科普-为自己的博客免费加上小绿锁
date: 2017/05/07 01:01:54       
categories: 
- 科普
tags: 
- HTTP
- HTTPS
---


![https.jpg](https://ooo.0o0.ooo/2017/05/07/590edced5545e.jpg)

在如今的`HTTPS`大当其道的情况下自己的博客要是还没有用上。作为互联网的螺丝钉(`码农`)岂不是很没面子。

# 使用CLOUDFLARE
这里使用[CLOUDFLARE](http://www.CLOUDFLARE.com)来提供`HTTPS`服务。

- 在其官网进行注册，按照提示添加好自己的域名即可。
- 之后需要在自己域名的提供商处修改`DNS服务器`，我是在万网购买的修改后如下图：
![1.jpg](https://ooo.0o0.ooo/2017/05/07/590edd1a4cfd0.jpg)
其中的`DNS服务器地址`由`CLOUDFLARE`是提供的。
修改完成之后通常需要等待一段时间才能生效。
- 接着在`CLOUDFLARE`配置`DNS`解析：
![DNS解析.jpg](https://ooo.0o0.ooo/2017/05/07/590edd4913c2b.jpg)
点击`CLOUDFLARE`顶部的`DNS`进行如我上图中的配置，和之前的配置没有什么区别。

等待一段时间之后发现使用`HTTP`,`HTTPS`都能访问，但是最好还是能在访问`HTTP`的时候能强制跳转到`HTTPS`.

- 在`CLOUDFLARE`菜单栏点击`page-rules`之后新建一个`page rule`：
![强制https.jpg](https://ooo.0o0.ooo/2017/05/07/590edd73a9f9d.jpg)
这样整个网站的请求都会强制到请求到`HTTPS`.

<!--more-->

# 主题配置
由于我才用的是`Hexo`中的`Next`主题，其中配置了`CNZZ`站长统计。其中配置的`CNZZ`统计JS是才用的`HTTP`。导致在首页的时候`chrome`一直提示感叹号。
修改站点`themes/next/layout/_scripts/third-party/analytics`目录下的`cnzz-analytics.swig`文件
```
{% if theme.cnzz_siteid %}

  <div style="display: none;">
    <script src="https://s6.cnzz.com/stat.php?id={{ theme.cnzz_siteid }}&web_id={{ theme.cnzz_siteid }}" type="text/javascript"></script>
  </div>

{% endif %}
```
之后再进行构建的时候就会使用`HTTPS`.

> 值得注意一点的是之后文章中所使用的图片都要用`HTTPS`的地址了，不然`chrome`会提示感叹号。


> 个人博客地址：[http://crossoverjie.top](http://crossoverjie.top)。

> GitHub地址：[https://github.com/crossoverJie](https://github.com/crossoverJie)。





