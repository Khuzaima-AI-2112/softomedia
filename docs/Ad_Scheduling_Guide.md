# Ad Scheduling Guide

## Overview

The Ad Scheduling feature allows brands to control when their campaigns run by setting day-of-week and time-range rules. Your ads are automatically placed into a 1-minute loop that repeats throughout each hour.

## How It Works

### The 1-Minute Loop System

- **12 Slots**: Each minute is divided into 12 slots
- **5 Seconds Each**: Each slot plays for exactly 5 seconds
- **Repeats 60 Times**: The same 12-slot pattern repeats every minute for the full hour
- **Fair Distribution**: All scheduled campaigns share the 12 slots equally using round-robin

**Example:**
If 3 campaigns (yours + 2 others) are all scheduled for 2:00 PM - 3:00 PM:
- The system creates a 12-slot loop
- Each campaign appears 4 times in that loop (12 ÷ 3 = 4)
- This loop plays 60 times during the hour
- **Result**: Your ad plays 240 times per hour (4 × 60)

## Creating a Schedule

### Step 1: Upload Your Campaign

1. Log in to your Brand Dashboard
2. Click **"📤 Create Campaign"**
3. Fill in campaign details (title, video file, duration)
4. Upload your ad creative

### Step 2: Enable Scheduling

1. Scroll to the **"Ad Scheduling"** section
2. Check **"Enable Ad Scheduling"**
3. The schedule rules interface will appear

### Step 3: Add Schedule Rules

Each rule defines when your ad should play:

**Day Selection:**
- Choose from presets:
  - **Mondays - Fridays** (weekdays)
  - **Saturdays - Sundays** (weekends)
  - **Every Day**

**Time Range:**
- Set start time (e.g., 11:30)
- Set end time (e.g., 13:00)

**Multiple Time Ranges:**
- Click **"+ Add Rule"** to add more schedule windows
- Example: Run during lunch (11:30-13:00) AND dinner (18:00-23:45)

### Step 4: Submit Campaign

1. Review your schedule settings
2. Click **"Upload Campaign"**
3. Your ad will now only play during scheduled times

## Example Schedules

### Example 1: Business Hours Only
```
Rule 1:
- Days: Mondays - Fridays
- Time: 09:00 to 17:00
```
*Your ad plays weekdays, 9 AM to 5 PM only*

### Example 2: Rush Hours
```
Rule 1:
- Days: Mondays - Fridays
- Time: 07:00 to 09:00

Rule 2:
- Days: Mondays - Fridays
- Time: 17:00 to 19:00
```
*Your ad plays during morning and evening commutes*

### Example 3: Weekend Evenings
```
Rule 1:
- Days: Saturdays - Sundays  
- Time: 18:00 to 23:00
```
*Your ad plays weekend evenings only*

### Example 4: Lunch & Dinner
```
Rule 1:
- Days: Every Day
- Time: 11:30 to 13:30

Rule 2:
- Days: Every Day
- Time: 18:00 to 21:00
```
*Your ad plays during meal times, every day*

## Viewing Your Schedule

### Schedule Timeline

1. Go to your **Brand Dashboard**
2. Click **"📅 View Schedule Timeline"**
3. See a 24-hour visual timeline showing:
   - When your campaigns are scheduled
   - Colored bars for each hour
   - Overlaps with other campaigns

### Understanding the Timeline

- **Colored Bars**: Show when your ad is eligible to play
- **No Bar**: Your ad will not play during that hour
- **Hover**: See campaign details in a tooltip

## Best Practices

### Maximizing Ad Exposure

1. **Peak Hours**: Schedule your ads during high-traffic times
2. **Multiple Rules**: Use multiple time ranges to catch different audiences
3. **Always-On Option**: Don't enable scheduling if you want 24/7 coverage

### Avoiding Zero Impressions

- ⚠️ **Make sure your schedule has at least one active rule**
- ⚠️ **Verify start time is before end time**
- ⚠️ **Check you've selected at least one day**

### Testing Your Schedule

1. Create a campaign with a test schedule
2. Note the current day and time
3. Ensure your test schedule includes NOW
4. Visit a screen player to confirm your ad appears

## Understanding Slot Allocation

### How Slots Are Assigned

When multiple campaigns schedule for the same time:

**Scenario**: 6 campaigns all scheduled 2:00 PM - 3:00 PM

**Allocation**:
- 12 slots available in the loop
- 6 campaigns need slots
- Result: Each campaign gets 2 slots (12 ÷ 6 = 2)

**Fair Distribution**:
```
Slot 0 → Campaign A
Slot 1 → Campaign B
Slot 2 → Campaign C
Slot 3 → Campaign D
Slot 4 → Campaign E
Slot 5 → Campaign F
Slot 6 → Campaign A (repeats)
Slot 7 → Campaign B
Slot 8 → Campaign C
Slot 9 → Campaign D
Slot 10 → Campaign E
Slot 11 → Campaign F
```

Each campaign appears 2 times per minute × 60 repeats = **120 plays per hour**

## Troubleshooting

### My ad isn't showing

**Check:**
1. Is scheduling enabled? If yes, verify current time matches a schedule rule
2. Are rules configured correctly? (start < end, days selected)
3. Is the campaign status "active"? Check your dashboard

### Timeline shows no bars

**Solution:**
- Scheduling may be disabled
- OR no schedule rules exist
- Click "Edit" on your campaign and verify schedule settings

### Ad plays at wrong times

**Verify:**
1. Check timezone (schedules use server time)
2. Review all schedule rules for conflicts
3. Ensure you saved changes after editing

## Managing Schedules

### Editing an Existing Schedule

1. Go to **Brand Dashboard**
2. Find your campaign in the list
3. Click **"Edit"** (when available)
4. Modify schedule rules
5. Click **"Save"**

### Disabling Scheduling

1. Edit your campaign
2. Uncheck **"Enable Ad Scheduling"**
3. Save changes
4. Your ad now plays 24/7

### Deleting a Schedule Rule

1. In the schedule section, find the rule to remove
2. Click **"✕ Remove Rule"**
3. Confirm and save

## FAQs

**Q: Can I have different schedules for weekdays vs. weekends?**  
A: Yes! Create separate rules for weekdays and weekends with different time ranges.

**Q: What happens if I schedule for a time that has many other ads?**  
A: The 12 slots are shared fairly using round-robin. You'll get fewer plays per hour, but still guaranteed airtime.

**Q: Can I schedule specific dates (e.g., only January 1)?**  
A: Currently, schedules use recurring day-of-week patterns. Use the campaign start_date and end_date for specific date ranges.

**Q: How many schedule rules can I create?**  
A: There's no hard limit, but we recommend keeping it simple with 2-3 rules for clarity.

**Q: Do I pay for scheduled hours only?**  
A: Check your billing details, but generally you're charged per impression (actual plays), not scheduled time.

## Getting Help

If you need assistance:
1. Review this guide
2. Check the schedule timeline for visualization
3. Contact support with your campaign ID

---

*Last Updated: December 30, 2025*
