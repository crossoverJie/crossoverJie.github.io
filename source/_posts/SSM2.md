---
title: SSM(二)Lucene全文检索
date: 2016/7/6 21:57:41     
categories: 
- SSM
tags: 
- Java
- Lucene
- IDEA
---

![pexels-photo-257875.jpeg](https://i.loli.net/2017/07/29/597c7694a0f58.jpeg)


# 前言
> 大家平时肯定都有用过全文检索工具，最常用的百度谷歌就是其中的典型。如果自己能够做一个那是不是想想就逼格满满呢。[Apache](http://lucene.apache.org/)就为我们提供了这样一个框架，以下就是在实际开发中加入Lucene的一个小Demo。


----------
# 获取Maven依赖
首先看一下实际运行的效果图：
![](http://i.imgur.com/pTTnv3R.png)
![](http://i.imgur.com/nRcHFQg.png)
<!--more-->
这个项目是基于之前使用IDEA搭建的SSM的基础上进行增加的，建议小白先看下一我。[上一篇博客](http://crossoverjie.top/2016/06/28/SSM1/)，以及共享在Github上的[源码](https://github.com/crossoverJie/SSM)。
以下是Lucene所需要的依赖：
```xml
<!--加入lucene-->
        <!-- https://mvnrepository.com/artifact/org.apache.lucene/lucene-core -->
        <dependency>
            <groupId>org.apache.lucene</groupId>
            <artifactId>lucene-core</artifactId>
            <version>${lucene.version}</version>
        </dependency>
        <!-- https://mvnrepository.com/artifact/org.apache.lucene/lucene-queryparser -->
        <dependency>
            <groupId>org.apache.lucene</groupId>
            <artifactId>lucene-queryparser</artifactId>
            <version>${lucene.version}</version>
        </dependency>
        <!-- https://mvnrepository.com/artifact/org.apache.lucene/lucene-analyzers-common -->
        <dependency>
            <groupId>org.apache.lucene</groupId>
            <artifactId>lucene-analyzers-common</artifactId>
            <version>${lucene.version}</version>
        </dependency>

        <!--lucene中文分词-->
        <!-- https://mvnrepository.com/artifact/org.apache.lucene/lucene-analyzers-smartcn -->
        <dependency>
            <groupId>org.apache.lucene</groupId>
            <artifactId>lucene-analyzers-smartcn</artifactId>
            <version>${lucene.version}</version>
        </dependency>

        <!--lucene高亮-->
        <!-- https://mvnrepository.com/artifact/org.apache.lucene/lucene-highlighter -->
        <dependency>
            <groupId>org.apache.lucene</groupId>
            <artifactId>lucene-highlighter</artifactId>
            <version>${lucene.version}</version>
        </dependency>
```
具体的用途我都写有注释。
在IDEA中修改了Pom.xml文件之后只需要点击如图所示的按钮即可重新获取依赖：
![](http://i.imgur.com/0XU7DjK.png)


----------
# 编写Lucene工具类
这个工具类中的具体代码我就不单独提出来说了，每个关键的地方我都写有注释，不清楚的再讨论。
```java
package com.crossoverJie.lucene;

import com.crossoverJie.pojo.User;
import org.apache.lucene.analysis.TokenStream;
import org.apache.lucene.analysis.cn.smart.SmartChineseAnalyzer;
import org.apache.lucene.document.Document;
import org.apache.lucene.document.Field;
import org.apache.lucene.document.StringField;
import org.apache.lucene.document.TextField;
import org.apache.lucene.index.*;
import org.apache.lucene.queryparser.classic.QueryParser;
import org.apache.lucene.search.*;
import org.apache.lucene.search.highlight.*;
import org.apache.lucene.store.Directory;
import org.apache.lucene.store.FSDirectory;

import java.io.StringReader;
import java.nio.file.Paths;
import java.util.LinkedList;
import java.util.List;
import com.crossoverJie.util.*;

/**
 * 博客索引类
 * @author Administrator
 *
 */
public class LuceneIndex {

	private Directory dir=null;


	/**
	 * 获取IndexWriter实例
	 * @return
	 * @throws Exception
	 */
	private IndexWriter getWriter()throws Exception{
		/**
		 * 生成的索引我放在了C盘，可以根据自己的需要放在具体位置
		 */
		dir= FSDirectory.open(Paths.get("C://lucene"));
		SmartChineseAnalyzer analyzer=new SmartChineseAnalyzer();
		IndexWriterConfig iwc=new IndexWriterConfig(analyzer);
		IndexWriter writer=new IndexWriter(dir, iwc);
		return writer;
	}

	/**
	 * 添加博客索引
	 * @param user
	 */
	public void addIndex(User user)throws Exception{
		IndexWriter writer=getWriter();
		Document doc=new Document();
		doc.add(new StringField("id",String.valueOf(user.getUserId()), Field.Store.YES));
		/**
		 * yes是会将数据存进索引，如果查询结果中需要将记录显示出来就要存进去，如果查询结果
		 * 只是显示标题之类的就可以不用存，而且内容过长不建议存进去
		 * 使用TextField类是可以用于查询的。
		 */
		doc.add(new TextField("username", user.getUsername(), Field.Store.YES));
		doc.add(new TextField("description",user.getDescription(), Field.Store.YES));
		writer.addDocument(doc);
		writer.close();
	}

	/**
	 * 更新博客索引
	 * @param user
	 * @throws Exception
	 */
	public void updateIndex(User user)throws Exception{
		IndexWriter writer=getWriter();
		Document doc=new Document();
		doc.add(new StringField("id",String.valueOf(user.getUserId()), Field.Store.YES));
		doc.add(new TextField("username", user.getUsername(), Field.Store.YES));
		doc.add(new TextField("description",user.getDescription(), Field.Store.YES));
		writer.updateDocument(new Term("id", String.valueOf(user.getUserId())), doc);
		writer.close();
	}

	/**
	 * 删除指定博客的索引
	 * @param userId
	 * @throws Exception
	 */
	public void deleteIndex(String userId)throws Exception{
		IndexWriter writer=getWriter();
		writer.deleteDocuments(new Term("id", userId));
		writer.forceMergeDeletes(); // 强制删除
		writer.commit();
		writer.close();
	}

	/**
	 * 查询用户
	 * @param q 查询关键字
	 * @return
	 * @throws Exception
	 */
	public List<User> searchBlog(String q)throws Exception{
		/**
		 * 注意的是查询索引的位置得是存放索引的位置，不然会找不到。
		 */
		dir= FSDirectory.open(Paths.get("C://lucene"));
		IndexReader reader = DirectoryReader.open(dir);
		IndexSearcher is=new IndexSearcher(reader);
		BooleanQuery.Builder booleanQuery = new BooleanQuery.Builder();
		SmartChineseAnalyzer analyzer=new SmartChineseAnalyzer();
		/**
		 * username和description就是我们需要进行查找的两个字段
		 * 同时在存放索引的时候要使用TextField类进行存放。
		 */
		QueryParser parser=new QueryParser("username",analyzer);
		Query query=parser.parse(q);
		QueryParser parser2=new QueryParser("description",analyzer);
		Query query2=parser2.parse(q);
		booleanQuery.add(query, BooleanClause.Occur.SHOULD);
		booleanQuery.add(query2, BooleanClause.Occur.SHOULD);
		TopDocs hits=is.search(booleanQuery.build(), 100);
		QueryScorer scorer=new QueryScorer(query);
		Fragmenter fragmenter = new SimpleSpanFragmenter(scorer);
		/**
		 * 这里可以根据自己的需要来自定义查找关键字高亮时的样式。
		 */
		SimpleHTMLFormatter simpleHTMLFormatter=new SimpleHTMLFormatter("<b><font color='red'>","</font></b>");
		Highlighter highlighter=new Highlighter(simpleHTMLFormatter, scorer);
		highlighter.setTextFragmenter(fragmenter);
		List<User> userList=new LinkedList<User>();
		for(ScoreDoc scoreDoc:hits.scoreDocs){
			Document doc=is.doc(scoreDoc.doc);
			User user=new User();
			user.setUserId(Integer.parseInt(doc.get(("id"))));
			user.setDescription(doc.get(("description")));
			String username=doc.get("username");
			String description=doc.get("description");
			if(username!=null){
				TokenStream tokenStream = analyzer.tokenStream("username", new StringReader(username));
				String husername=highlighter.getBestFragment(tokenStream, username);
				if(StringUtil.isEmpty(husername)){
					user.setUsername(username);
				}else{
					user.setUsername(husername);
				}
			}
			if(description!=null){
				TokenStream tokenStream = analyzer.tokenStream("description", new StringReader(description));
				String hContent=highlighter.getBestFragment(tokenStream, description);
				if(StringUtil.isEmpty(hContent)){
					if(description.length()<=200){
						user.setDescription(description);
					}else{
						user.setDescription(description.substring(0, 200));
					}
				}else{
					user.setDescription(hContent);
				}
			}
			userList.add(user);
		}
		return userList;
	}
}

```
# 查询Controller的编写
接下来是查询Controller：
```java
    @RequestMapping("/q")
    public String search(@RequestParam(value = "q", required = false,defaultValue = "") String q,
                         @RequestParam(value = "page", required = false, defaultValue = "1") String page,
                         Model model,
                         HttpServletRequest request) throws Exception {
        LuceneIndex luceneIndex = new LuceneIndex() ;
        List<User> userList = luceneIndex.searchBlog(q);
        /**
         * 关于查询之后的分页我采用的是每次分页发起的请求都是将所有的数据查询出来，
         * 具体是第几页再截取对应页数的数据，典型的拿空间换时间的做法，如果各位有什么
         * 高招欢迎受教。
         */
        Integer toIndex = userList.size() >= Integer.parseInt(page) * 5 ? Integer.parseInt(page) * 5 : userList.size();
        List<User> newList = userList.subList((Integer.parseInt(page) - 1) * 5, toIndex);
        model.addAttribute("userList",newList) ;
        String s = this.genUpAndDownPageCode(Integer.parseInt(page), userList.size(), q, 5, request.getServletContext().
                getContextPath());
        model.addAttribute("pageHtml",s) ;
        model.addAttribute("q",q) ;
        model.addAttribute("resultTotal",userList.size()) ;
        model.addAttribute("pageTitle","搜索关键字'" + q + "'结果页面") ;

        return "queryResult";
    }
```
其中有用到一个`genUpAndDownPageCode()`方法来生成分页的Html代码，如下：
```java
    /**
     * 查询之后的分页
     * @param page
     * @param totalNum
     * @param q
     * @param pageSize
     * @param projectContext
     * @return
     */
    private String genUpAndDownPageCode(int page,Integer totalNum,String q,Integer pageSize,String projectContext){
        long totalPage=totalNum%pageSize==0?totalNum/pageSize:totalNum/pageSize+1;
        StringBuffer pageCode=new StringBuffer();
        if(totalPage==0){
            return "";
        }else{
            pageCode.append("<nav>");
            pageCode.append("<ul class='pager' >");
            if(page>1){
                pageCode.append("<li><a href='"+projectContext+"/q?page="+(page-1)+"&q="+q+"'>上一页</a></li>");
            }else{
                pageCode.append("<li class='disabled'><a href='#'>上一页</a></li>");
            }
            if(page<totalPage){
                pageCode.append("<li><a href='"+projectContext+"/q?page="+(page+1)+"&q="+q+"'>下一页</a></li>");
            }else{
                pageCode.append("<li class='disabled'><a href='#'>下一页</a></li>");
            }
            pageCode.append("</ul>");
            pageCode.append("</nav>");
        }
        return pageCode.toString();
    }
```
代码比较简单，就是根据的页数、总页数来生成分页代码，对了我前端采用的是现在流行的Bootstrap，这个有不会的可以去他[官网](http://www.bootcss.com/)看看，比较简单易上手。接下来只需要编写显示界面就大功告成了。
![](http://i.imgur.com/NUZM7Bc.png)


----------
# 显示界面
我只贴关键代码，具体的可以去Github上查看。
```html
<c:choose>
                    <c:when test="${userList.size()==0 }">
                        <div align="center" style="padding-top: 20px"><font color="red">${q}</font>未查询到结果，请换个关键字试试！</div>
                    </c:when>
                    <c:otherwise>
                        <div align="center" style="padding-top: 20px">
                            查询<font color="red">${q}</font>关键字，约${resultTotal}条记录！
                        </div>
                        <c:forEach var="u" items="${userList }" varStatus="status">
                            <div class="panel-heading ">

                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="row">
                                            <div class="col-md-12">
                                                <b>
                                                    <a href="<%=path %>/user/showUser/${u.userId}">${u.username}</a>
                                                </b>
                                                <br/>
                                                    ${u.description}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-4 col-md-offset-2">
                                        <p class="text-muted text-right">
                                                ${u.password}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div class="panel-footer">
                                <p class="text-right">
							<span class="label label-default">
							<span class="glyphicon glyphicon-comment" aria-hidden="true"></span>
							 ${u.password}
							</span>
                                </p>
                            </div>
                        </c:forEach>
                    </c:otherwise>
                </c:choose>
```
利用`JSTL`标签即可将数据循环展示出来，关键字就不需要单独做处理了，在后台查询的时候已经做了修改了。


----------
# 总结
关于全文检索的框架不止`Lucene`还有`solr`，具体谁好有什么区别我也不太清楚，准备下来花点时间研究下。哦对了，最近又有点想做`Android`开发了，感觉做点东西能够实实在在的摸得到逼格确实要高些(现在主要在做后端开发)，感兴趣的朋友可以关注下。哦对了，直接运行我代码的朋友要下注意：
- 首先要将数据库倒到自己的MySQL上![](http://i.imgur.com/rSodBB5.png)
- 之后在首次运行的时候需要点击![](http://i.imgur.com/jQySeaf.png)重新生成索引按钮生成一遍索引之后才能进行搜索，因为现在的数据是直接存到数据库中的，并没有在新增的时候就增加索引，在实际开发的时候需要在新增数据那里再生成一份索引，就直接调用`LuceneIndex`类中的`addIndex`方法传入实体即可，再做更新、删除操作的时候也同样需要对索引做操作。