---
title: 日常记录（二）SpringMvc导出Excel
date: 2016/6/14 20:38:06  
categories: 
- 日常记录
tags: 
- poi
- Java
---
# 前言
> 相信很多朋友在实际工作中都会要将数据导出成Excel的需求，通常这样的做法有两种。
> 一是采用JXL来生成Excel，之后保存到服务器，然后在生成页面之后下载该文件。
> 二是使用POI来生成Excel，之后使用Stream的方式输出到前台直接下载`(ps:当然也可以生成到服务器中再下载。)`。这里我们讨论第二种。
> *至于两种方式的优缺点请自行[百度](http://www.baidu.com)*。

----------

# Struts2的方式
通常我会将已经生成好的`HSSFWorkbook`放到一个`InputStream`中，然后再到xml配置文件中将返回结果更改为`stream`的方式。如下：
```java
private void responseData(HSSFWorkbook wb) throws IOException {
	ByteArrayOutputStream baos = new ByteArrayOutputStream();
	wb.write(baos);
	baos.flush();
	byte[] aa = baos.toByteArray();
	excelStream = new ByteArrayInputStream(aa, 0, aa.length);
	baos.close();
}
```
<!--more-->
配置文件：
```java
<action name="exportXxx" class="xxxAction" method="exportXxx">
	<result name="exportSuccess" type="stream">
		<param name="inputName">excelStream</param>
    	<param name="contentType">application/vnd.ms-excel</param>
    	<param name="contentDisposition">attachment;filename="Undefined.xls"</param>
	</result>
</action>
```
这样即可达到点击链接即可直接下载文件的目的。

----------
# SpringMVC的方式
先贴代码：
```java
@RequestMapping("/exportXxx.action")
public void exportXxx(HttpServletRequest request, HttpServletResponse response,
		@RequestParam(value="scheduleId", defaultValue="0")int scheduleId){
	HSSFWorkbook wb = createExcel(scheduleId) ;
	try {
		response.setHeader("Content-Disposition", "attachment; filename=appointmentUser.xls");
		response.setContentType("application/vnd.ms-excel; charset=utf-8") ;
		OutputStream out = response.getOutputStream() ;
		wb.write(out) ;
		out.flush();
		out.close();
	} catch (IOException e) {
		e.printStackTrace();
	} 
}
```
其实springMVC和Struts2的原理上是一样的，只是Struts2是才去配置文件的方式。首先是使用`createExcel()`这个方法来生成Excel并返回，最后利用r`response`即可向前台输出Excel，这种方法是通用的，也可以试用与`Servlet、Struts2等`。我们只需要在`response`的头信息中设置相应的输出信息即可。


----------
# 总结
不管是使用`Struts2`，还是使用`SpringMVC`究其根本都是使用的`response`，所以只要我们把`response`理解透了不管是下载图片、world、Excel还是其他什么文件都是一样的。