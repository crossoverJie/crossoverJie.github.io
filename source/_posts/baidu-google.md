---
title: 让百度和google收录我们的网站
date: 2016/5/19 16:07:44   
categories: 
- 小技巧
tags: 
- baidu
- google
---
# 前言
花了几天时间终于把这个看似高大上的博客搞好了，但是发现只能通过在地址栏输入地址进行访问，这很明显和我装X装到底的性格，于是乎在查阅了嘟爷的博客，和我各种百度终于搞出来了。


----------
# 让谷歌收录
让谷歌收录还是比较简单，首先我们肯定是要翻墙的(这个就不仔细说了，具体百度。)
由于我这里突然登不上google账号了，所以下次补充截图。同体来说就是以下步骤：
> - 下载google的html验证文件放到网站的根目录，使google能够访问得到。
> - 在谷歌站长工具里加上自己的站点地图。
<!--more-->

----------
# 创建站点地图
站点地图是一种文件，可以通过该文件列出您网站上的网页，从而将您网站内容的组织架构告知Google和其他搜索引擎，以便更加智能的抓取你的网站信息。
首先我们要为Hexo安装谷歌和百度的插件(博主是用Hexo来搭建的博客)，如下：
```

npm install hexo-generator-sitemap --save
npm install hexo-generator-baidu-sitemap --save
```
在博客的根目录中的`_config.yml`文件中加入以下内容：
![](http://i.imgur.com/CUrNUtM.png)
之后部署上去之后如果在地址栏后面加上站点地图如下的话表示部署成功：
![](http://i.imgur.com/AAujKdL.png)
![](http://i.imgur.com/4K6JvJ4.png)

----------

# 让百度收录
有三种方式可以让百度收录我们的网站。
第一种：主动推送
我用Java写了一个小程序，可以手工的自己推送地址给百度。
```java
package top.crossoverjie.post;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.URL;
import java.net.URLConnection;

public class Post {

	public static void main(String[] args) {
					  
		String url = "http://data.zz.baidu.com/urls?site=crossoverjie.top&token=1002EzhDReuy34dq";// 网站的服务器连接
		String[] param = { 
			// 需要推送的网址
//			"http://crossoverjie.top/tags",
//			"http://crossoverjie.top/categories",
			//"http://crossoverjie.top/about/"
			"http://crossoverjie.top/2016/05/14/java-thread1"
			
		};
		String json = Post(url, param);// 执行推送方法
		System.out.println("结果是" + json); // 打印推送结果
	}

	/**
	 * 百度链接实时推送
	 * 
	 * @param PostUrl
	 * @param Parameters
	 * @return
	 */
	public static String Post(String PostUrl, String[] Parameters) {
		if (null == PostUrl || null == Parameters || Parameters.length == 0) {
			return null;
		}
		String result = "";
		PrintWriter out = null;
		BufferedReader in = null;
		try {
			// 建立URL之间的连接
			URLConnection conn = new URL(PostUrl).openConnection();
			// 设置通用的请求属性
			conn.setRequestProperty("Host", "data.zz.baidu.com");
			conn.setRequestProperty("User-Agent", "curl/7.12.1");
			conn.setRequestProperty("Content-Length", "83");
			conn.setRequestProperty("Content-Type", "text/plain");

			// 发送POST请求必须设置如下两行
			conn.setDoInput(true);
			conn.setDoOutput(true);

			// 获取conn对应的输出流
			out = new PrintWriter(conn.getOutputStream());
			// 发送请求参数
			String param = "";
			for (String s : Parameters) {
				param += s + "\n";
			}
			out.print(param.trim());
			// 进行输出流的缓冲
			out.flush();
			// 通过BufferedReader输入流来读取Url的响应
			in = new BufferedReader(
					new InputStreamReader(conn.getInputStream()));
			String line;
			while ( (line = in.readLine()) != null) {
				result += line;
			}

		} catch (Exception e) {
			System.out.println("发送post请求出现异常！" + e);
			e.printStackTrace();
		} finally {
			try {
				if (out != null) {
					out.close();
				}
				if (in != null) {
					in.close();
				}

			} catch (IOException ex) {
				ex.printStackTrace();
			}
		}
		return result;
	}
}
```
运行之后结果如下：
```java
结果是{"remain":499,"success":1}
```
`remain`表示还有多少可以推送，我这里表示还有499条。`success`表示成功推送了多少条链接，我这里表示成功推送了一条链接。

第二种是主动推送，可以按照百度的教程进行配置：
![](http://i.imgur.com/hDU8NPb.png)

第三种就是配置站点地图了，按照之前将的将站点地图安装到项目中，参照我的配置即可：
![](http://i.imgur.com/20Sh5GR.png)
如果能像我这个一样状态正常，能获取到URL数量就表示成功了。

----------

# 总结
在整个过程中不是我黑百度，百度的效率真是太低了。我头一天在google提交上去第二天就能收到了，百度是我提交了大概一周多才给我收录进去，这当然肯定也和我的内容有关系。
![](http://i.imgur.com/41EH6bE.png)
![](http://i.imgur.com/cyVNJTg.png)
![](http://i.imgur.com/L4q7lq1.png)
![](http://i.imgur.com/mVnjUDa.png)

