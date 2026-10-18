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

### Adatbázis-struktúra (Database Schema)

- **Felhasználók (User):** A rendszer központi felhasználói táblája, ahol a jogosultsági szint (`Role`) definiálja a megrendelői, éttermi vagy futár szerepkört, kapcsolatot biztosítva az ügyfél (`CustomerID`) és a futár (`RiderID`) entitások felé.
- **Éttermek (Restaurant):** A partner éttermek törzsadatait, elnevezését és fizikai elérhetőségét (`Name`, `Address`) tároló entitás.
- **Termékek / Étlap (Product):** Az éttermek kínálatát képező tételek nyilvántartása, amely az adott étteremhez rendelve (`RestaurantID`) rögzíti az árat, elérhetőséget és leírást.
- **Rendelés fejléce (Order):** Egy adott tranzakció összesített adatai, amely összefogja a megrendelőt (`CustomerID`), az éttermet (`RestaurantID`), a végösszeget (`TotalAmount`), a rendelési státuszt és az időbélyeget.
- **Rendelési tételek (OrderLine):** A rendelések és termékek közötti több-a-többhöz (N:M) kapcsolatot feloldó kapcsolótábla, amely rögzíti a kiválasztott tételt (`ProductID`), a rendelt mennyiséget (`Quantity`) és a vásárláskori egységárat (`UnitPrice`).
- **Kiszállítás (Delivery):** A kézbesítési folyamatot menedzselő modul, amely az adott megrendeléshez (`OrderID`) kijelöli a futárt (`RiderID`), nyomon követi az aktuális logisztikai státuszt és a sikeres kézbesítés idejét (`DeliveredAt`).

## Futárkiosztási logika (Dispatch Logic)

A rendszer a rendelés feladásakor a következő paraméterek súlyozásával választja ki a legmegfelelőbb futárt:

1. **Távolság (Proximity):** A futár és az étterem közötti úthálózati távolság minimalizálása.
2. **Csomagméret és kapacitás (Order Size):** A rendelés terjedelme és súlya.
3. **Szállítási mód (Vehicle Type):** 
   * Kerékpár (kisebb méretű, sűrű városi rendelésekhez)
   * Robogó / Motorkerékpár (közepes méret és távolság)
   * Személyautó (nagy volumenű vagy külvárosi rendelésekhez)
4. **Futár elérhetősége és értékelése:** Aktív státusz és megbízhatósági mutatók ellenőrzése.

<img width="1540" height="1440" alt="Futar App - Functionalities" src="https://github.com/user-attachments/assets/ecb88d55-ac29-4aa0-b04a-65f26127878c" />


### Basic Database Structure - PosgreSQL - Neon DB


<img width="1255" height="662" alt="QuickDBD-export" src="https://github.com/user-attachments/assets/a8c9f7bc-2a7d-4871-83c0-4291555ec1b2" />

