/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    vm._uid = uid++


    // a flag to avoid this being observed
    vm._isVue = true
    // 处理组件配置项
    // merge options // 如果子组件性能优化
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // 子组件:性能优化，减少原型链的动态查找，提高执行效率
      initInternalComponent(vm, options)
    } else {
      // 根组件走这里 :选项合并，将全局配置选项合并到根组件
      // 组件选项合并，其实发生在三个地方
      // 1.Vue.component(CompName,Comp),做了选项合并，合并的Vue内置的全局组件和用户自己注册的全局组件，
      // 组件翻到全局的components选项中
      // 2. {components:{xxx}},局部注册，执行编译器生成的render函数时做了选项合并，会合并全局配置项到局部配置项上
      // 3.
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
  
    // expose real self
    vm._self = vm

      // 重点，整个初始化最重要的部分，也是核心

    // 组件关系属性的初始化，比如:$parent $root $children
    initLifecycle(vm)
    // 初始化自定义事件
    initEvents(vm)
    // 初始化插槽，获取this.$slots,定义 this._c 即createElement 方法，平时使用的h函数
    initRender(vm)
    // 执行beforeCreate 生命周期函数
    callHook(vm, 'beforeCreate')
    // 初始化initInject，得到result[key]=val 形式的配置对象，并做响应式处理
    initInjections(vm) // resolve injections before data/props
    // 响应式原理的核心，处理props methods computed data watch 等选项
    initState(vm)
    // 处理provide选项
    // 总结provide/inject 的实现原理
    initProvide(vm) // resolve provide after data/props
    // 调用created 声明周期钩子函数
    callHook(vm, 'created')

    // 如果存在el选项，自动执行$mount
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  // 基础构造函数上的配置创建vm.$options
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  // 有render 函数，将其赋值到vm.$options
  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}
// 解析函数上解析配置项
export function resolveConstructorOptions (Ctor: Class<Component>) {
  // 从实例构造函数上获取选项
  let options = Ctor.options
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    // 缓存
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // 说明基类的配置项发生了更改
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      // 找到更改的选项
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        // 将更改的选项和extend options
        extend(Ctor.extendOptions, modifiedOptions)
      }
      // 将新的选项赋值给options
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
