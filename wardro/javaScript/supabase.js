// supabase.js

const SUPABASE_URL = "https://hifunnzmpvlukmaoilyx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpZnVubnptcHZsdWttYW9pbHl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDM4OTUsImV4cCI6MjA5NjcxOTg5NX0.Ul7p1SliKI9JnU-YnDvhmujFytrB0psHQUYYgzU6YwM";

// Use the global `supabase` provided by the CDN and create the client
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ──────────────────────────────────────────
// AUTH
// ──────────────────────────────────────────

async function register(email, password, username) {
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { data: { username } }
  });

  if (error) throw error;
  return data.user;
}

async function login(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });

  if (error) throw error;
  return data.user;
}

async function logout() {
  const { error } = await db.auth.signOut();
  if (error) throw error;
}

async function getCurrentUser() {
  const { data: { user } } = await db.auth.getUser();
  return user; // null wenn nicht eingeloggt
}

// Auth-State Listener (wird bei Login/Logout automatisch aufgerufen)
db.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN") {
    console.log("Eingeloggt:", session.user.email);
    // z.B. UI updaten
  }
  if (event === "SIGNED_OUT") {
    console.log("Ausgeloggt");
    // z.B. zur Login-Seite weiterleiten
  }
});

// ──────────────────────────────────────────
// CLOTHES
// ──────────────────────────────────────────

async function getClothes() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Nicht eingeloggt");

  const { data, error } = await db
    .from("clothes")
    .select("*, categories(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

async function addCloth(name, imageFile, options = {}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Nicht eingeloggt");

  // 1. Bild hochladen
  const fileName = `${user.id}/${Date.now()}_${imageFile.name}`;
  const { error: uploadError } = await db.storage
    .from("clothes-images")
    .upload(fileName, imageFile);

  if (uploadError) throw uploadError;

  // 2. Öffentliche URL holen
  const { data: { publicUrl } } = db.storage
    .from("clothes-images")
    .getPublicUrl(fileName);

  // 3. Eintrag in DB speichern
  const { data, error } = await db
    .from("clothes")
    .insert({
      user_id:     user.id,
      name:        name,
      image_path:  publicUrl,
      category_id: options.categoryId  || null,
      description: options.description || null,
      color:       options.color       || null,
      brand:       options.brand       || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function deleteCloth(clothId, imagePath) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Nicht eingeloggt");

  // Bild aus Storage löschen
  const fileName = imagePath.split("/clothes-images/")[1];
  await db.storage.from("clothes-images").remove([fileName]);

  // DB-Eintrag löschen
  const { error } = await db
    .from("clothes")
    .delete()
    .eq("id", clothId)
    .eq("user_id", user.id); // Sicherheit: nur eigene Einträge

  if (error) throw error;
}

// ──────────────────────────────────────────
// KATEGORIEN
// ──────────────────────────────────────────

async function getCategories() {
  const { data, error } = await db
    .from("categories")
    .select("*")
    .order("name");

  if (error) throw error;
  return data;
}