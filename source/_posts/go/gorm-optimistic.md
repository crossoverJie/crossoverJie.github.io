---
title: 写了一个 gorm 乐观锁插件
date: 2021/03/15 08:25:26 
categories: 
- 数据库
tags: 
- Go
- Java
- OOP
- 乐观锁
---

![](https://i.loli.net/2021/03/26/kiPBytpXJ7T4csH.jpg)

# 前言

最近在用 `Go` 写业务的时碰到了并发更新数据的场景，由于该业务并发度不高，只是为了防止出现并发时数据异常。

所以自然就想到了乐观锁的解决方案。

<!--more-->

# 实现

乐观锁的实现比较简单，相信大部分有数据库使用经验的都能想到。

```sql
UPDATE `table` SET `amount`=100,`version`=version+1 WHERE `version` = 1 AND `id` = 1
```

需要在表中新增一个类似于 `version` 的字段，本质上我们只是执行这段 `SQL`，在更新时比较当前版本与数据库版本是否一致。

![](https://i.loli.net/2021/03/26/FYTKZ2lS1WhDg6w.jpg)

如上图所示：版本一致则更新成功，并且将版本号+1；如果不一致则认为出现并发冲突，更新失败。

这时可以直接返回失败，让业务重试；当然也可以再次获取最新数据进行更新尝试。

---

我们使用的是 `gorm` 这个 `orm` 库，不过我查阅了官方文档却没有发现乐观锁相关的支持，看样子后续也不打算提供实现。

![](https://i.loli.net/2021/03/26/CHGLJpvBn4SK89i.jpg)

不过借助 `gorm` 实现也很简单：

```go
type Optimistic struct {
	Id      int64   `gorm:"column:id;primary_key;AUTO_INCREMENT" json:"id"`
	UserId  string  `gorm:"column:user_id;default:0;NOT NULL" json:"user_id"` // 用户ID
	Amount  float32 `gorm:"column:amount;NOT NULL" json:"amount"`             // 金额
	Version int64   `gorm:"column:version;default:0;NOT NULL" json:"version"` // 版本
}

func TestUpdate(t *testing.T) {
	dsn := "root:abc123@/test?charset=utf8&parseTime=True&loc=Local"
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	var out Optimistic
	db.First(&out, Optimistic{Id: 1})
	out.Amount = out.Amount + 10
	column := db.Model(&out).Where("id", out.Id).Where("version", out.Version).
		UpdateColumn("amount", out.Amount).
		UpdateColumn("version", gorm.Expr("version+1"))
	fmt.Printf("#######update %v line \n", column.RowsAffected)
}
```

这里我们创建了一张 `t_optimistic` 表用于测试，生成的 `SQL` 也满足乐观锁的要求。

不过考虑到这类业务的通用性，每次需要乐观锁更新时都需要这样硬编码并不太合适。对于业务来说其实 `version` 是多少压根不需要关心，只要能满足并发更新时的准确性即可。

因此我做了一个封装，最终使用如下：

```go

var out Optimistic
db.First(&out, Optimistic{Id: 1})
out.Amount = out.Amount + 10
if err = UpdateWithOptimistic(db, &out, nil, 0, 0); err != nil {
		fmt.Printf("%+v \n", err)
}
```

- 这里的使用场景是每次更新时将 `amount` 金额加上 `10`。

这样只会更新一次，如果更新失败会返回一个异常。

当然也支持更新失败时执行一个回调函数，在该函数中实现对应的业务逻辑，同时会使用该业务逻辑尝试更新 N 次。

```go
func BenchmarkUpdateWithOptimistic(b *testing.B) {
	dsn := "root:abc123@/test?charset=utf8&parseTime=True&loc=Local"
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		fmt.Println(err)
		return
	}
	b.RunParallel(func(pb *testing.PB) {
		var out Optimistic
		db.First(&out, Optimistic{Id: 1})
		out.Amount = out.Amount + 10
		err = UpdateWithOptimistic(db, &out, func(model Lock) Lock {
			bizModel := model.(*Optimistic)
			bizModel.Amount = bizModel.Amount + 10
			return bizModel
		}, 3, 0)
		if err != nil {
			fmt.Printf("%+v \n", err)
		}
	})
}
```

以上代码的目的是：

将 `amount` 金额 `+10`，失败时再次依然将金额+10，尝试更新 `3` 次；经过上述的并行测试，最终查看数据库确认数据并没有发生错误。

## 面向接口编程

下面来看看具体是如何实现的；其实真正核心的代码也比较少：

```go
func UpdateWithOptimistic(db *gorm.DB, model Lock, callBack func(model Lock) Lock, retryCount, currentRetryCount int32) (err error) {
	if currentRetryCount > retryCount {
		return errors.WithStack(NewOptimisticError("Maximum number of retries exceeded:" + strconv.Itoa(int(retryCount))))
	}
	currentVersion := model.GetVersion()
	model.SetVersion(currentVersion + 1)
	column := db.Model(model).Where("version", currentVersion).UpdateColumns(model)
	affected := column.RowsAffected
	if affected == 0 {
		if callBack == nil && retryCount == 0 {
			return errors.WithStack(NewOptimisticError("Concurrent optimistic update error"))
		}
		time.Sleep(100 * time.Millisecond)
		db.First(model)
		bizModel := callBack(model)
		currentRetryCount++
		err := UpdateWithOptimistic(db, bizModel, callBack, retryCount, currentRetryCount)
		if err != nil {
			return err
		}
	}
	return column.Error

}
```

具体步骤如下：

- 判断重试次数是否达到上限。
- 获取当前更新对象的版本号，将当前版本号 +1。
- 根据版本号条件执行更新语句。
- 更新成功直接返回。
- 更新失败 `affected == 0`  时，执行重试逻辑。
    - 重新查询该对象的最新数据，目的是获取最新版本号。
    - 执行回调函数。
    - 从回调函数中拿到最新的业务数据。
    - 递归调用自己执行更新，直到重试次数达到上限。

这里有几个地方值得说一下；由于 `Go` 目前还不支持泛型，所以我们如果想要获取 `struct` 中的 `version` 字段只能通过反射。

考虑到反射的性能损耗以及代码的可读性，有没有更”优雅“的实现方式呢？

于是我定义了一个 `interface`:

```go
type Lock interface {
	SetVersion(version int64)
	GetVersion() int64
}
```

其中只有两个方法，目的则是获取 `struct` 中的 `version` 字段；所以每个需要乐观锁的 `struct` 都得实现该接口，类似于这样：

```go
func (o *Optimistic) GetVersion() int64 {
	return o.Version
}

func (o *Optimistic) SetVersion(version int64) {
	o.Version = version
}
```

这样还带来了一个额外的好处：

![](https://i.loli.net/2021/03/26/nrA3FCHx4w1vLMV.jpg)

一旦该结构体没有实现接口，在乐观锁更新时编译器便会提前报错，如果使用反射只能是在运行期间才能进行校验。

所以这里在接收数据库实体的便可以是 `Lock` 接口，同时获取和重新设置 `version` 字段也是非常的方便。

```go
currentVersion := model.GetVersion()
model.SetVersion(currentVersion + 1)
```

## 类型断言

当并发更新失败时`affected == 0`，便会回调传入进来的回调函数，在回调函数中我们需要实现自己的业务逻辑。

```go
err = UpdateWithOptimistic(db, &out, func(model Lock) Lock {
			bizModel := model.(*Optimistic)
			bizModel.Amount = bizModel.Amount + 10
			return bizModel
		}, 2, 0)
		if err != nil {
			fmt.Printf("%+v \n", err)
		}
```

但由于回调函数的入参只能知道是一个 `Lock` 接口，并不清楚具体是哪个 `struct`，所以在执行业务逻辑之前需要将这个接口转换为具体的 `struct`。

这其实和 `Java` 中的父类向子类转型非常类似，必须得是强制类型转换，也就是说运行时可能会出问题。

在 `Go` 语言中这样的行为被称为`类型断言`；虽然叫法不同，但目的类似。其语法如下：

```go
x.(T)
x:表示 interface 
T:表示 向下转型的具体 struct
```

所以在回调函数中得根据自己的需要将 `interface` 转换为自己的 `struct`，这里得确保是自己所使用的 `struct` ，因为是强制转换，编译器无法帮你做校验，具体能否转换成功得在运行时才知道。

# 总结

有需要的朋友可以在这里获取到源码及具体使用方式:

[https://github.com/crossoverJie/gorm-optimistic](https://github.com/crossoverJie/gorm-optimistic)

最近工作中使用了几种不同的编程语言，会发现除了语言自身的语法特性外大部分知识点都是相同的；

比如面向对象、数据库、IO操作等；所以掌握了这些基本知识，学习其他语言自然就能触类旁通了。
