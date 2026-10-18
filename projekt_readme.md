# Futar WebApp

Kétirányú ételrendelés- és logisztikakezelő webalkalmazás, amely összekapcsolja a vendéglátóhelyeket a futárokkal. A rendszer automatikus diszpécserlogikával osztja ki a rendeléseket a legközelebbi, megfelelő kapacitású és járművel rendelkező futárnak.

## Funkciók és modulok

A bejelentkezést követően a felhasználók a szerepkörüknek megfelelő felületre jutnak:

### Éttermi felület (Restaurant Dashboard)

* **Termék- és menükezelés (Add Products / Food):** Ételek, kategóriák és árak rögzítése, elérhetőség kezelése.
* **Új rendelés feladása (New Order):** Rendelési tételek és kiszállítási cím megadása.
* **Futárkeresés indítása (Find Rider):** A megrendelés átadása az automatikus futárkiosztó motornak.
* **Rendeléstörténet (Order History):** Korábbi és aktív rendelések státuszának követése (folyamatban, kézbesítve, meghiúsult).

### Futár felület (Rider Dashboard)

* **Térkép és pozíciókövetés (Map with Current Location):** Aktuális tartózkodási hely valós idejű megjelenítése.
* **Bejövő rendelések kezelése (Incoming Order):** Rendelési ajánlatok fogadása.
* **Döntéshozatal (Accept / Decline Order):** A felkérés elfogadása vagy elutasítása, amely kihat a futár belső értékelésére (Affect Rating).
* **Cím és részletek (Delivery Location + Details):** Átvételi és leadási címek, valamint a kapcsolódó instrukciók megtekintése.
* **Státuszlezárás (Complete / Incomplete):** A kézbesítés sikerességének vagy sikertelenségének rögzítése.

## Futárkiosztási logika (Dispatch Logic)

A rendszer a rendelés feladásakor a következő paraméterek súlyozásával választja ki a legmegfelelőbb futárt:

1. **Távolság (Proximity):** A futár és az étterem közötti úthálózati távolság minimalizálása.
2. **Csomagméret és kapacitás (Order Size):** A rendelés terjedelme és súlya.
3. **Szállítási mód (Vehicle Type):** 
   * Kerékpár (kisebb méretű, sűrű városi rendelésekhez)
   * Robogó / Motorkerékpár (közepes méret és távolság)
   * Személyautó (nagy volumenű vagy külvárosi rendelésekhez)
4. **Futár elérhetősége és értékelése:** Aktív státusz és megbízhatósági mutatók ellenőrzése.

## Telepítés és futtatás

```bash
git clone https://github.com/<felhasznalonev>/futar-webapp.git
cd futar-webapp
npm install
npm run dev
```