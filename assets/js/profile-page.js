const db=window.mjhkSupabase;
const slug=document.body.dataset.profileSlug;
const titleEl=document.getElementById("profileTitle");
const summaryEl=document.getElementById("profileSummary");
const contentEl=document.getElementById("profileContent");

function state(message,error=false){
  contentEl.innerHTML=`<p class="state ${error?"error":""}">${message}</p>`;
}

async function loadProfile(){
  if(!db){state("Konten profile belum dapat dimuat.",true);return}

  const {data,error}=await db
    .from("profile_pages")
    .select("slug,judul,ringkasan,content_markdown,status")
    .eq("slug",slug)
    .eq("status","publish")
    .maybeSingle();

  if(error){
    console.error(error);
    state("Konten profile belum dapat dimuat. Silakan coba lagi nanti.",true);
    return;
  }

  if(!data){
    state("Konten halaman ini belum dipublikasikan.");
    return;
  }

  document.title=`${data.judul} | Masjid Jami' Harapan Kita`;
  titleEl.textContent=data.judul||"Profile Masjid";
  summaryEl.textContent=data.ringkasan||"Informasi Masjid Jami' Harapan Kita.";

  const raw=marked.parse(data.content_markdown||"");
  contentEl.innerHTML=DOMPurify.sanitize(raw,{
    USE_PROFILES:{html:true}
  });
}

loadProfile();
