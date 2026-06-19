# Audio-Visual Loop Architecture

## Core Concept
In the Softomedia ecosystem, **"Loops" are NOT infinite continuous streams.**
Instead, a Loop is a finite, hourly cycle of digital advertising slots scheduled for a specific time block during retail business hours. 

## The Cycle Structure
1. **The 14-Hour Grid:** The system operates on a standard 14-hour broadcast day (8:00 AM to 10:00 PM local store time).
2. **The Hourly Block:** Each hour represents one distinct "Loop".
3. **The Slot Cycle:** Within a single hourly Loop, there are exactly **12 advertising slots**.
4. **Playback Duration:** Each slot represents a slice of screen time. When playback begins, the screen iterates through the 12 slots sequentially. Once the cycle finishes, it repeats until the hour is over.

## Why Cycles Instead of Infinite Loops?
- **Predictability & Pricing:** By breaking time into fixed slots, we can price inventory accurately (e.g. "Slot 1 during High Traffic 5 PM").
- **Targeting:** Advertisers can book specific hours rather than just running indefinitely anywhere.
- **Validation:** Test suites and verification systems rely on explicit limits to check whether an advertiser's content successfully loaded into the assigned cycle for a specific hour block.

## Loop Management (Admin Portal)
- Loops are generated automatically using the **Generate Loops** engine in the Admin portal.
- The Generation Engine pulls active bookings and injects them into the correct 12-slot cycles for the specified dates.
- Fallback content plays automatically for any hour that lacks an approved advertising Loop.
