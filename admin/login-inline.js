const db=window.mjhkSupabase;
(async()=>{const {data}=await db.auth.getSession();if(data.session)location.href="index.html"})();
document.getElementById("loginForm").addEventListener("submit",async e=>{
e.preventDefault();
const btn=document.getElementById("loginBtn"),msg=document.getElementById("msg");
btn.disabled=true;btn.textContent="Memproses...";
const {error}=await db.auth.signInWithPassword({
email:document.getElementById("email").value.trim(),
password:document.getElementById("password").value
});
if(error){msg.style.display="block";msg.textContent=error.message;btn.disabled=false;btn.textContent="Masuk";return}
location.href="index.html";
});
