import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../scripts/admin-i18n.js', import.meta.url), 'utf8');

function makeDOM() {
  const elements = new Map();
  class E {
    constructor(tag, id = '', classes = '') {
      this.nodeType = 1; this.tagName = tag.toUpperCase(); this.id = id;
      this.classes = classes.split(' ').filter(Boolean);
      this.childNodes = []; this.parentElement = null; this.attrs = new Map(); this.handlers = {};
      if (id) elements.set(id,this);
    }
    append(node) { node.parentElement = this; this.childNodes.push(node); return node; }
    matches(selector) {
      return selector.split(',').some(s => {
        const value = s.trim();
        return value.startsWith('.') ? this.classes.includes(value.slice(1)) : value.toUpperCase() === this.tagName;
      });
    }
    closest(selector) {
      for(let node = this;node;node=node.parentElement) if(node.matches(selector)) return node;
      return null;
    }
    hasAttribute(name) { return this.attrs.has(name); }
    getAttribute(name) { return this.attrs.get(name) ?? null; }
    setAttribute(name,value) { this.attrs.set(name,String(value)); }
    addEventListener(name,callback) { this.handlers[name]=callback; }
  }
  class T {
    constructor(value){ this.nodeType=3; this.nodeValue=value; this.parentElement=null; }
  }
  const body=new E('body');
  const nav=body.append(new E('nav'));
  const label=nav.append(new E('span')).append(new T('Tổng quan'));
  const caption=nav.append(new E('span')).append(new T('Không kết nối được'));
  const skipped=body.append(new E('pre')).append(new T('Thông tin cá nhân giữ nguyên'));
  const skill=body.append(new E('span','','skill-description')).append(new T('Skill instructions remain untouched'));
  const input=body.append(new E('input'));
  input.setAttribute('placeholder','Tìm công cụ, ID, tham số...');
  const select=body.append(new E('select','languageSelect'));
  select.value='en';
  const root = { lang: 'vi' };
  const document = {
    body,documentElement:root,
    getElementById(id){return elements.get(id)??null;},
    createTreeWalker(node){
      const flattened = [];
      const visit=parent => { for(const item of parent.childNodes??[]){ flattened.push(item); if(item.nodeType===1)visit(item); } };
      visit(node);let i=-1;
      return {get currentNode(){return flattened[i]},nextNode(){i++;return i<flattened.length;}};
    }
  };
  const observers=[];
  class MutationObserver {
    constructor(callback){this.callback=callback;observers.push(this);}
    observe(){}
  }
  const values=new Map();
  const localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  runInNewContext(source,{document,MutationObserver,NodeFilter:{SHOW_ELEMENT:1,SHOW_TEXT:4},localStorage});
  return { body,nav,label,caption,skipped,skill,input,select,root,observers,values,E,T };
}

test('Sakura Console defaults to English, switches to Vietnamese and keeps local data intact',()=>{
  const dom=makeDOM();
  assert.equal(dom.root.lang,'en');
  assert.equal(dom.label.nodeValue,'Overview');
  assert.equal(dom.caption.nodeValue,'Connection lost');
  assert.equal(dom.input.getAttribute('placeholder'),'Search tools, IDs, arguments...');
  assert.equal(dom.skipped.nodeValue,'Thông tin cá nhân giữ nguyên');
  assert.equal(dom.skill.nodeValue,'Skill instructions remain untouched');
  const dynamic=dom.nav.append(new dom.T('7 đang bật / 10 đã cài'));
  dom.observers[0].callback([{type:'childList',addedNodes:[dynamic]}]);
  assert.equal(dynamic.nodeValue,'7 enabled / 10 installed');
  dom.select.value='vi';dom.select.handlers.change();
  assert.equal(dom.root.lang,'vi');
  assert.equal(dom.label.nodeValue,'Tổng quan');
  assert.equal(dom.caption.nodeValue,'Không kết nối được');
  assert.equal(dynamic.nodeValue,'7 đang bật / 10 đã cài');
  assert.equal(dom.input.getAttribute('placeholder'),'Tìm công cụ, ID, tham số...');
  assert.equal(dom.values.get('umibridge.admin.language'),'vi');
  dom.select.value='en';dom.select.handlers.change();
  assert.equal(dom.label.nodeValue,'Overview');
  assert.equal(dom.root.lang,'en');
});
