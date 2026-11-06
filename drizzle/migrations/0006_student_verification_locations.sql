CREATE TABLE public.provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);
CREATE TABLE public.districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  province_id uuid NOT NULL REFERENCES public.provinces(id) ON DELETE CASCADE,
  UNIQUE (province_id, name)
);
CREATE TABLE public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  district_id uuid NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  UNIQUE (district_id, name)
);
ALTER TABLE public.schools ADD COLUMN sector_id uuid REFERENCES public.sectors(id);
ALTER TABLE public.schools ADD COLUMN active boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.schools.sector_id IS 'Sector from the official location list; NULL for schools added before location levels existed.';
CREATE TABLE public.student_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code text NOT NULL,
  full_name text NOT NULL,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_code)
);
GRANT SELECT ON public.provinces TO anon, authenticated;
GRANT ALL ON public.provinces TO service_role;
GRANT SELECT ON public.districts TO anon, authenticated;
GRANT ALL ON public.districts TO service_role;
GRANT SELECT ON public.sectors TO anon, authenticated;
GRANT ALL ON public.sectors TO service_role;
GRANT SELECT ON public.schools TO anon;
GRANT SELECT ON public.student_codes TO authenticated;
GRANT ALL ON public.student_codes TO service_role;
ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public province list" ON public.provinces FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public district list" ON public.districts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public sector list" ON public.sectors FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public school directory" ON public.schools FOR SELECT TO anon USING (true);
CREATE POLICY "Site owner reads student codes" ON public.student_codes FOR SELECT TO authenticated USING (is_site_owner());
INSERT INTO public.provinces (name) VALUES ('East'), ('Kigali City'), ('North'), ('South'), ('West');
INSERT INTO public.districts (name, province_id) SELECT v.name, p.id FROM (VALUES ('Bugesera'), ('Gatsibo'), ('Kayonza'), ('Kirehe'), ('Ngoma'), ('Nyagatare'), ('Rwamagana')) AS v(name) JOIN public.provinces p ON p.name = 'East';
INSERT INTO public.districts (name, province_id) SELECT v.name, p.id FROM (VALUES ('Gasabo'), ('Kicukiro'), ('Nyarugenge')) AS v(name) JOIN public.provinces p ON p.name = 'Kigali City';
INSERT INTO public.districts (name, province_id) SELECT v.name, p.id FROM (VALUES ('Burera'), ('Gakenke'), ('Gicumbi'), ('Musanze'), ('Rulindo')) AS v(name) JOIN public.provinces p ON p.name = 'North';
INSERT INTO public.districts (name, province_id) SELECT v.name, p.id FROM (VALUES ('Gisagara'), ('Huye'), ('Kamonyi'), ('Muhanga'), ('Nyamagabe'), ('Nyanza'), ('Nyaruguru'), ('Ruhango')) AS v(name) JOIN public.provinces p ON p.name = 'South';
INSERT INTO public.districts (name, province_id) SELECT v.name, p.id FROM (VALUES ('Karongi'), ('Ngororero'), ('Nyabihu'), ('Nyamasheke'), ('Rubavu'), ('Rusizi'), ('Rutsiro')) AS v(name) JOIN public.provinces p ON p.name = 'West';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Gashora'), ('Juru'), ('Kamabuye'), ('Mareba'), ('Mayange'), ('Musenyi'), ('Mwogo'), ('Ngeruka'), ('Ntarama'), ('Nyamata'), ('Nyarugenge'), ('Rilima'), ('Ruhuha'), ('Rweru'), ('Shyara')) AS v(name) JOIN public.districts d ON d.name = 'Bugesera';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Gasange'), ('Gatsibo'), ('Gitoki'), ('Kabarore'), ('Kageyo'), ('Kiramuruzi'), ('Kiziguro'), ('Muhura'), ('Murambi'), ('Ngarama'), ('Nyagihanga'), ('Remera'), ('Rugarama'), ('Rwimbogo')) AS v(name) JOIN public.districts d ON d.name = 'Gatsibo';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Gahini'), ('Kabare'), ('Kabarondo'), ('Mukarange'), ('Murama'), ('Murundi'), ('Mwiri'), ('Ndego'), ('Nyamirama'), ('Rukara'), ('Ruramira'), ('Rwinkwavu')) AS v(name) JOIN public.districts d ON d.name = 'Kayonza';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Gahara'), ('Gatore'), ('Kigarama'), ('Kigina'), ('Kirehe'), ('Mahama'), ('Mpanga'), ('Musaza'), ('Mushikiri'), ('Nasho'), ('Nyamugari'), ('Nyarubuye')) AS v(name) JOIN public.districts d ON d.name = 'Kirehe';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Gashanda'), ('Jarama'), ('Karembo'), ('Kazo'), ('Kibungo'), ('Mugesera'), ('Murama'), ('Mutenderi'), ('Remera'), ('Rukira'), ('Rukumberi'), ('Rurenge'), ('Sake'), ('Zaza')) AS v(name) JOIN public.districts d ON d.name = 'Ngoma';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Gatunda'), ('Karama'), ('Karangazi'), ('Katabagemu'), ('Kiyombe'), ('Matimba'), ('Mimuri'), ('Mukama'), ('Musheri'), ('Nyagatare'), ('Rukomo'), ('Rwempasha'), ('Rwimiyaga'), ('Tabagwe')) AS v(name) JOIN public.districts d ON d.name = 'Nyagatare';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Fumbwe'), ('Gahengeri'), ('Gishali'), ('Karenge'), ('Kigabiro'), ('Muhazi'), ('Munyaga'), ('Munyiginya'), ('Musha'), ('Muyumbu'), ('Mwulire'), ('Nyakaliro'), ('Nzige'), ('Rubona')) AS v(name) JOIN public.districts d ON d.name = 'Rwamagana';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Bumbogo'), ('Gatsata'), ('Gikomero'), ('Gisozi'), ('Jabana'), ('Jali'), ('Kacyiru'), ('Kimihurura'), ('Kimironko'), ('Kinyinya'), ('Ndera'), ('Nduba'), ('Remera'), ('Rusororo'), ('Rutunga')) AS v(name) JOIN public.districts d ON d.name = 'Gasabo';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Gahanga'), ('Gatenga'), ('Gikondo'), ('Kagarama'), ('Kanombe'), ('Kicukiro'), ('Kigarama'), ('Masaka'), ('Niboye'), ('Nyarugunga')) AS v(name) JOIN public.districts d ON d.name = 'Kicukiro';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Gitega'), ('Kanyinya'), ('Kigali'), ('Kimisagara'), ('Mageregere'), ('Muhima'), ('Nyakabanda'), ('Nyamirambo'), ('Nyarugenge'), ('Rwezamenyo')) AS v(name) JOIN public.districts d ON d.name = 'Nyarugenge';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Bungwe'), ('Butaro'), ('Cyanika'), ('Cyeru'), ('Gahunga'), ('Gatebe'), ('Gitovu'), ('Kagogo'), ('Kinoni'), ('Kinyababa'), ('Kivuye'), ('Nemba'), ('Rugarama'), ('Rugengabari'), ('Ruhunde'), ('Rusarabuye'), ('Rwerere')) AS v(name) JOIN public.districts d ON d.name = 'Burera';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Busengo'), ('Coko'), ('Cyabingo'), ('Gakenke'), ('Gashenyi'), ('Janja'), ('Kamubuga'), ('Karambo'), ('Kivuruga'), ('Mataba'), ('Minazi'), ('Mugunga'), ('Muhondo'), ('Muyongwe'), ('Muzo'), ('Nemba'), ('Ruli'), ('Rusasa'), ('Rushashi')) AS v(name) JOIN public.districts d ON d.name = 'Gakenke';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Bukure'), ('Bwisige'), ('Byumba'), ('Cyumba'), ('Giti'), ('Kageyo'), ('Kaniga'), ('Manyagiro'), ('Miyove'), ('Mukarange'), ('Muko'), ('Mutete'), ('Nyamiyaga'), ('Nyankenke'), ('Rubaya'), ('Rukomo'), ('Rushaki'), ('Rutare'), ('Ruvune'), ('Rwamiko'), ('Shangasha')) AS v(name) JOIN public.districts d ON d.name = 'Gicumbi';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Busogo'), ('Cyuve'), ('Gacaca'), ('Gashaki'), ('Gataraga'), ('Kimonyi'), ('Kinigi'), ('Muhoza'), ('Muko'), ('Musanze'), ('Nkotsi'), ('Nyange'), ('Remera'), ('Rwaza'), ('Shingiro')) AS v(name) JOIN public.districts d ON d.name = 'Musanze';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Base'), ('Burega'), ('Bushoki'), ('Buyoga'), ('Cyinzuzi'), ('Cyungo'), ('Kinihira'), ('Kisaro'), ('Masoro'), ('Mbogo'), ('Murambi'), ('Ngoma'), ('Ntarabana'), ('Rukozo'), ('Rusiga'), ('Shyorongi'), ('Tumba')) AS v(name) JOIN public.districts d ON d.name = 'Rulindo';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Gikonko'), ('Gishubi'), ('Kansi'), ('Kibirizi'), ('Kigembe'), ('Mamba'), ('Muganza'), ('Mugombwa'), ('Mukindo'), ('Musha'), ('Ndora'), ('Nyanza'), ('Save')) AS v(name) JOIN public.districts d ON d.name = 'Gisagara';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Gishamvu'), ('Huye'), ('Karama'), ('Kigoma'), ('Kinazi'), ('Maraba'), ('Mbazi'), ('Mukura'), ('Ngoma'), ('Ruhashya'), ('Rusatira'), ('Rwaniro'), ('Simbi'), ('Tumba')) AS v(name) JOIN public.districts d ON d.name = 'Huye';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Gacurabwenge'), ('Karama'), ('Kayenzi'), ('Kayumbu'), ('Mugina'), ('Musambira'), ('Ngamba'), ('Nyamiyaga'), ('Nyarubaka'), ('Rugarika'), ('Rukoma'), ('Runda')) AS v(name) JOIN public.districts d ON d.name = 'Kamonyi';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Cyeza'), ('Kabacuzi'), ('Kibangu'), ('Kiyumba'), ('Muhanga'), ('Mushishiro'), ('Nyabinoni'), ('Nyamabuye'), ('Nyarusange'), ('Rongi'), ('Rugendabari'), ('Shyogwe')) AS v(name) JOIN public.districts d ON d.name = 'Muhanga';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Buruhukiro'), ('Cyanika'), ('Gasaka'), ('Gatare'), ('Kaduha'), ('Kamegeri'), ('Kibirizi'), ('Kibumbwe'), ('Kitabi'), ('Mbazi'), ('Mugano'), ('Musange'), ('Musebeya'), ('Mushubi'), ('Nkomane'), ('Tare'), ('Uwinkingi')) AS v(name) JOIN public.districts d ON d.name = 'Nyamagabe';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Busasamana'), ('Busoro'), ('Cyabakamyi'), ('Kibilizi'), ('Kigoma'), ('Mukingo'), ('Muyira'), ('Ntyazo'), ('Nyagisozi'), ('Rwabicuma')) AS v(name) JOIN public.districts d ON d.name = 'Nyanza';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Busanze'), ('Cyahinda'), ('Kibeho'), ('Kivu'), ('Mata'), ('Muganza'), ('Munini'), ('Ngera'), ('Ngoma'), ('Nyabimata'), ('Nyagisozi'), ('Ruheru'), ('Ruramba'), ('Rusenge')) AS v(name) JOIN public.districts d ON d.name = 'Nyaruguru';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Bweramana'), ('Byimana'), ('Kabagali'), ('Kinazi'), ('Kinihira'), ('Mbuye'), ('Mwendo'), ('Ntongwe'), ('Ruhango')) AS v(name) JOIN public.districts d ON d.name = 'Ruhango';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Bwishyura'), ('Gashari'), ('Gishyita'), ('Gitesi'), ('Mubuga'), ('Murambi'), ('Murundi'), ('Mutuntu'), ('Rubengera'), ('Rugabano'), ('Ruganda'), ('Rwankuba'), ('Twumba')) AS v(name) JOIN public.districts d ON d.name = 'Karongi';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Bwira'), ('Gatumba'), ('Hindiro'), ('Kabaya'), ('Kageyo'), ('Kavumu'), ('Matyazo'), ('Muhanda'), ('Muhororo'), ('Ndaro'), ('Ngororero'), ('Nyange'), ('Sovu')) AS v(name) JOIN public.districts d ON d.name = 'Ngororero';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Bigogwe'), ('Jenda'), ('Jomba'), ('Kabatwa'), ('Karago'), ('Kintobo'), ('Mukamira'), ('Muringa'), ('Rambura'), ('Rugera'), ('Rurembo'), ('Shyira')) AS v(name) JOIN public.districts d ON d.name = 'Nyabihu';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Bushekeri'), ('Bushenge'), ('Cyato'), ('Gihombo'), ('Kagano'), ('Kanjongo'), ('Karambi'), ('Karengera'), ('Kirimbi'), ('Macuba'), ('Mahembe'), ('Nyabitekeri'), ('Rangiro'), ('Ruharambuga'), ('Shangi')) AS v(name) JOIN public.districts d ON d.name = 'Nyamasheke';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Bugeshi'), ('Busasamana'), ('Cyanzarwe'), ('Gisenyi'), ('Kanama'), ('Kanzenze'), ('Mudende'), ('Nyakiriba'), ('Nyamyumba'), ('Nyundo'), ('Rubavu'), ('Rugerero')) AS v(name) JOIN public.districts d ON d.name = 'Rubavu';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Bugarama'), ('Butare'), ('Bweyeye'), ('Gashonga'), ('Giheke'), ('Gihundwe'), ('Gikundamvura'), ('Gitambi'), ('Kamembe'), ('Muganza'), ('Mururu'), ('Nkanka'), ('Nkombo'), ('Nkungu'), ('Nyakabuye'), ('Nyakarenzo'), ('Nzahaha'), ('Rwimbogo')) AS v(name) JOIN public.districts d ON d.name = 'Rusizi';
INSERT INTO public.sectors (name, district_id) SELECT v.name, d.id FROM (VALUES ('Boneza'), ('Gihango'), ('Kigeyo'), ('Kivumu'), ('Manihira'), ('Mukura'), ('Murunda'), ('Musasa'), ('Mushonyi'), ('Mushubati'), ('Nyabirasi'), ('Ruhango'), ('Rusebeya')) AS v(name) JOIN public.districts d ON d.name = 'Rutsiro';