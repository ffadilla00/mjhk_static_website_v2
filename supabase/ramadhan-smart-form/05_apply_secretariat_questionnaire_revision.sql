begin;

alter table public.aspirasi_ramadhan
  add column if not exists program_dipertahankan_pilihan text[];

alter table public.aspirasi_ramadhan
  add column if not exists program_dipertahankan_lainnya text;

alter table public.aspirasi_ramadhan
  alter column form_version set default '1448h-v2';

alter table public.aspirasi_ramadhan drop constraint if exists aspirasi_ramadhan_program_prioritas_check;
alter table public.aspirasi_ramadhan add constraint aspirasi_ramadhan_program_prioritas_check check (
  cardinality(program_prioritas) between 1 and 5
  and program_prioritas <@ array[
    'pra_ramadhan','tarawih_witir','kultum_kajian','tadarus','ifthar_tajil','pesantren_anak',
    'itikaf_10_malam','santunan_ziswaf','zakat_infaq_fidyah','santunan_yatim_dhuafa',
    'takbir_idul_fitri','halal_bihalal','lainnya'
  ]::text[]
);

alter table public.aspirasi_ramadhan drop constraint if exists aspirasi_ramadhan_area_peningkatan_check;
alter table public.aspirasi_ramadhan add constraint aspirasi_ramadhan_area_peningkatan_check check (
  cardinality(area_peningkatan) between 1 and 3
  and area_peningkatan <@ array[
    'kenyamanan_ibadah','kualitas_kajian','anak_remaja','tajil_buka_puasa','kebersihan_fasilitas',
    'informasi_kegiatan','pengelolaan_ziswaf','kualitas_imam_khatib_tarawih','kualitas_mc_tarawih',
    'sepuluh_malam_terakhir','tidak_ada','lainnya'
  ]::text[]
  and (not ('tidak_ada' = any(area_peningkatan)) or cardinality(area_peningkatan) = 1)
);

alter table public.aspirasi_ramadhan drop constraint if exists aspirasi_ramadhan_program_dipertahankan_pilihan_check;
alter table public.aspirasi_ramadhan add constraint aspirasi_ramadhan_program_dipertahankan_pilihan_check check (
  program_dipertahankan_pilihan is null
  or (
    cardinality(program_dipertahankan_pilihan) between 1 and 5
    and program_dipertahankan_pilihan <@ array[
      'pra_ramadhan','tarawih_witir','kultum_kajian','tadarus','ifthar_tajil','pesantren_anak',
      'itikaf_10_malam','zakat_infaq_fidyah','santunan_yatim_dhuafa',
      'takbir_idul_fitri','halal_bihalal','lainnya'
    ]::text[]
  )
);

alter table public.aspirasi_ramadhan drop constraint if exists aspirasi_ramadhan_program_dipertahankan_lainnya_check;
alter table public.aspirasi_ramadhan add constraint aspirasi_ramadhan_program_dipertahankan_lainnya_check check (
  char_length(coalesce(program_dipertahankan_lainnya,'')) <= 200
  and (
    program_dipertahankan_pilihan is null
    or not ('lainnya' = any(program_dipertahankan_pilihan))
    or nullif(btrim(program_dipertahankan_lainnya),'') is not null
  )
);

create index if not exists aspirasi_ramadhan_program_dipertahankan_gin_idx
  on public.aspirasi_ramadhan using gin (program_dipertahankan_pilihan);

grant insert (program_dipertahankan_pilihan, program_dipertahankan_lainnya)
  on table public.aspirasi_ramadhan to anon, authenticated;

comment on column public.aspirasi_ramadhan.program_dipertahankan is
  'Jawaban bebas versi 1. Dipertahankan agar data lama tetap terbaca.';
comment on column public.aspirasi_ramadhan.program_dipertahankan_pilihan is
  'Pilihan program yang perlu dipertahankan pada formulir versi 2.';
comment on column public.aspirasi_ramadhan.program_dipertahankan_lainnya is
  'Keterangan pilihan lainnya untuk program yang perlu dipertahankan.';

commit;
