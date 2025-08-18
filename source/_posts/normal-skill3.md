---
title: 日常记录（三）更换Hexo主题
date: 2016/6/18 0:05:24   
categories: 
- 日常记录
tags: 
- Hexo
---
# 前言
> 由于博主的喜新厌旧，再经过一段时间对上一个主题的审美疲劳加上我专(zhuang)研(bi)的精神
> 于是就想找一个B格较高的主题。经过一段时间的查找发现NexT这个主题简洁而不失华丽，低调而不失逼格(就不收广告费了)特别适合我，接着就着手开干。


----------
# 安装NexT主题
## 从Git上克隆主题
这里我就不介绍有关Hexo的东西了，默认是知道如何搭建Hexo博客的。还不太清楚的请自行百度。
首先将NexT主题先克隆到自己电脑上：
- `cd your-hexo-site`
- `git clone https://github.com/iissnan/hexo-theme-next themes/next`。
## 安装主题
接下来我们只需要将站点下的`_config.yml`配置文件中的主题配置更换成Next，如下图：
![](http://i.imgur.com/GhhnMDs.png)
其实这样主题就配好了，是不是很简单
![](http://i.imgur.com/wQmHabT.gif)。
<!--more-->
----------
# NexT主题配置
## Hexo配置文件相关配置
Next主题的个人头像是在Hexo配置文件中的。
![](http://i.imgur.com/Wranuhu.png)
NexT同样也支持多说配置，我们只需要将你自己的多说账号也配置到Hexo的配置文件中即可。
`duoshuo_shortname: your name`
## Next配置文件相关配置
NexT主题非常吸引我的一点就是他支持打赏功能，这让我这种穷逼程序猿又看到了生路(多半也没人会给我打赏)，以下一段配置即可在每篇博文下边开启打赏功能。
![](http://i.imgur.com/EvWY5v0.png)
微信也是可以的，但是我找了半天没有找到生成微信支付码的地方。
其他的一些配置我觉得都比较简单，看官方的帮助文档也是完全可以的，有问题的我们可以再讨论。


----------
# 一个绕坑指南
我在换完NexT之后发现在首页
![](http://i.imgur.com/JA451zP.png)
这里显示的分类和便签的统计都是对的，但是点进去之后就是空白的。我查看了Hexo和NexT的文档发现我写的没有任何问题，之后就懵逼了。。。![](http://i.imgur.com/dQxzrn6.gif)各位有碰到这个问题的可以往下看。
## 绕坑
之后我仔细的查阅了NexT的文档，发现他所使用的tags和categories文件夹下的`index.md`的格式是这样的：
```
---
title: tags
date: 2016-06-16 02:13:06
type: "tags"
---
```
这和我之前使用的`JackMan`主题是完全不一样的(有关JackMan主题可以自行查阅)。
之后我讲categories文件下的`index.md`文件也换成这样的格式就没有问题了。如果你和我一样眼神不好的话建议配副眼镜。
# 总结
其实以上的很多东西都是在[NexT官方文档](http://theme-next.iissnan.com/)里查得到的，接下来我会尝试提一点`pull request`来更加深入的了解Hexo。