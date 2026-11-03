(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={rooms:[],students:[],selectedRoom:null,loaded:false,loading:false,rosterToken:0,loadPromise:null};
function field(item,keys,fallback=''){
if(!item||typeof item!=='object')return fallback;
for(const key of keys){
const value=item[key];
if(value!==undefined&&value!==null&&value!=='')return value;
}
return fallback;
}
function unwrap(value){
let result=value;
for(let i=0;i<3;i++){
if(!result||typeof result!=='object'||Array.isArray(result))break;
if(result.data&&typeof result.data==='object'){result=result.data}
else if(result.result&&typeof result.result==='object'){result=result.result}
else{break}
}
return result;
}
function readArray(value,keys){
const result=unwrap(value);
if(Array.isArray(result))return result;
if(!result||typeof result!=='object')return [];
for(const key of keys){
if(Array.isArray(result[key]))return result[key];
}
return [];
}
function roomId(room){return String(field(room,['id','classId','ClassID','classroomId','ClassroomID'],''))}
function roomName(room){return String(field(room,['className','ClassName','classLabel','ClassLabel','name','Name','level','Level'],'ห้องเรียน'))}
function studentName(student){
const full=field(student,['fullName','FullName','studentName','StudentName'],'');
if(full)return String(full);
return [
field(student,['prefix','Prefix'],''),
field(student,['firstName','FirstName'],''),
field(student,['lastName','LastName'],'')
].filter(Boolean).join(' ').trim();
}
function studentNumber(student,index){return field(student,['studentNo','StudentNo','studentNumber','StudentNumber'],index+1)}
function studentId(student){return field(student,['studentCode','StudentCode'],'—')}
function notice(message,icon='fa-spinner fa-spin'){
return '<div class="classroom-notice">'+
'<i class="fa-solid '+icon+'" style="font-size:23px;color:#146EF5"></i>'+
'<p>'+esc(message)+'</p>'+
'</div>';
}
function errorHtml(error){
const message=error instanceof Error?error.message:String(error||'เกิดข้อผิดพลาด');
return '<div class="comsc-error">'+
'<i class="fa-solid fa-circle-exclamation"></i>'+
'<strong>โหลดข้อมูลไม่สำเร็จ</strong>'+
'<p>'+esc(message)+'</p>'+
'</div>';
}
async function apiClassrooms(){
if(typeof window.COMSC?.getClassroomModuleData!=='function'){
throw new Error('ไม่พบ getClassroomModuleData ใน app.js');
}
return await window.COMSC.getClassroomModuleData();
}
async function apiStudents(classId){
if(typeof window.COMSC?.getClassroomStudents!=='function'){
throw new Error('ไม่พบ getClassroomStudents ใน app.js');
}
return await window.COMSC.getClassroomStudents(String(classId));
}
function renderClassrooms(){
const grid=$('classroom-grid');
if(!state.rooms.length){
grid.innerHTML=notice('ยังไม่พบข้อมูลห้องเรียน','fa-school');
return;
}
grid.innerHTML=state.rooms.map((room,index)=>{
const label=roomName(room);
const count=field(room,['studentCount','StudentCount'],null);
const countText=count===null?'เปิดดูรายชื่อนักเรียน':esc(count)+' คน';
return '<button type="button" class="classroom-tile" data-room-index="'+index+'">'+
'<div class="classroom-tile-head">'+
'<span class="classroom-tile-icon"><i class="fa-solid fa-users"></i></span>'+
'<i class="fa-solid fa-arrow-up-right-from-square" style="color:#94A3B8"></i>'+
'</div>'+
'<h3>'+esc(label)+'</h3>'+
'<p>'+countText+'</p>'+
'<div class="classroom-tile-foot">'+
'<span>ดูรายชื่อนักเรียน</span>'+
'<i class="fa-solid fa-arrow-right"></i>'+
'</div>'+
'</button>';
}).join('');
grid.querySelectorAll('[data-room-index]').forEach(button=>{
button.addEventListener('click',()=>{
window.openCOMSCRoster(Number(button.dataset.roomIndex));
});
});
}
window.loadCOMSCClassrooms=async function(force=false){
if(state.loading)return state.loadPromise;
if(state.loaded&&!force)return;
state.loading=true;
state.loaded=false;
state.selectedRoom=null;
++state.rosterToken;
$('classroom-roster').hidden=true;
$('classroom-grid').style.display='grid';
$('classroom-grid').innerHTML=notice('กำลังโหลดข้อมูลห้องเรียนจากระบบจริง...');
$('classroom-summary').textContent='กำลังเชื่อมต่อข้อมูลห้องเรียน';
state.loadPromise=(async()=>{
try{
const data=await apiClassrooms();
if(data?.success===false){
throw new Error(data.error?.message||data.message||'ไม่สามารถโหลดข้อมูลได้');
}
state.rooms=readArray(data,['classrooms','Classrooms']);
state.loaded=true;
const total=state.rooms.reduce((sum,room)=>sum+Number(room.studentCount||0),0);
$('classroom-summary').textContent=
'ห้องเรียนทั้งหมด '+state.rooms.length+' ห้อง · นักเรียนตามทะเบียน '+total+' คน';
renderClassrooms();
}catch(error){
console.error('COM SC classrooms:',error);
state.loaded=false;
$('classroom-summary').textContent='เชื่อมต่อข้อมูลห้องเรียนไม่สำเร็จ';
$('classroom-grid').innerHTML=errorHtml(error);
}finally{
state.loading=false;
state.loadPromise=null;
}
})();
return state.loadPromise;
};
window.openCOMSCRoster=async function(index){
const room=state.rooms[index];
if(!room)return;
state.selectedRoom=room;
const token=++state.rosterToken;
$('classroom-grid').style.display='none';
$('classroom-roster').hidden=false;
$('roster-title').textContent=roomName(room);
$('roster-description').textContent='กำลังโหลดรายชื่อนักเรียน';
$('roster-search').value='';
$('roster-result').innerHTML=notice('กำลังโหลดรายชื่อนักเรียน...');
try{
const id=roomId(room);
if(!id)throw new Error('ไม่พบรหัสห้องเรียนในข้อมูล API');
const data=await apiStudents(id);
if(token!==state.rosterToken)return;
if(data?.success===false){
throw new Error(data.error?.message||data.message||'ไม่สามารถโหลดรายชื่อได้');
}
state.students=readArray(data,['students','Students']);
$('roster-description').textContent='นักเรียนทั้งหมด '+state.students.length+' คน';
window.filterCOMSCRoster('');
}catch(error){
if(token!==state.rosterToken)return;
console.error('COM SC students:',error);
$('roster-description').textContent='โหลดรายชื่อนักเรียนไม่สำเร็จ';
$('roster-result').innerHTML=errorHtml(error);
}
};
window.closeCOMSCRoster=function(){
++state.rosterToken;
state.selectedRoom=null;
state.students=[];
$('classroom-roster').hidden=true;
$('classroom-grid').style.display='grid';
};
window.reloadCOMSCRoster=function(){
if(!state.selectedRoom)return;
const index=state.rooms.indexOf(state.selectedRoom);
if(index>=0)window.openCOMSCRoster(index);
};
window.filterCOMSCRoster=function(query=''){
const q=String(query).trim().toLocaleLowerCase();
const students=state.students.map((student,index)=>({student,index})).filter(({student,index})=>{
const text=[studentName(student),studentNumber(student,index),studentId(student)].join(' ').toLocaleLowerCase();
return text.includes(q);
});
if(!students.length){
$('roster-result').innerHTML=notice(
q?'ไม่พบนักเรียนที่ตรงกับคำค้นหา':'ยังไม่มีรายชื่อนักเรียนในห้องนี้',
'fa-users'
);
return;
}
const rows=students.map(({student,index})=>{
return '<tr>'+
'<td>'+esc(studentNumber(student,index))+'</td>'+
'<td>'+esc(studentName(student)||'ไม่ระบุชื่อ')+'</td>'+
'<td>'+esc(studentId(student))+'</td>'+
'</tr>';
}).join('');
$('roster-result').innerHTML=
'<div class="roster-table-wrap">'+
'<table class="roster-table">'+
'<thead><tr><th>เลขที่</th><th>ชื่อ–นามสกุล</th><th>รหัสนักเรียน</th></tr></thead>'+
'<tbody>'+rows+'</tbody>'+
'</table></div>'+
'<div class="roster-count">แสดง '+students.length+' จาก '+state.students.length+' คน</div>';
};
})();
