const KEY="boatai-history-v1";
export const getHistory=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}};
export const addHistory=item=>{const h=getHistory();h.unshift(item);localStorage.setItem(KEY,JSON.stringify(h.slice(0,500)));return h};
export const clearHistory=()=>localStorage.removeItem(KEY);
