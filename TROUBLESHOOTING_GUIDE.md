# Troubleshooting Guide: Login & Page Loading Issues

## Quick Diagnostics

### Enable Debug Logging
Open browser DevTools console and run:
```javascript
// Enable detailed authentication logs
localStorage.setItem('DEBUG_AUTH', 'true');
// Then reload the page
location.reload();
```

Monitor the console for `[v0]`, `[Auth]`, and `[Middleware]` prefixed messages.

---

## Common Issues & Solutions

### Issue: "Blank white screen after login"
**Symptoms**: 
- Logs in successfully
- Screen shows nothing for 2-5 seconds
- Then dashboard appears

**Root Causes**:
1. Dashboard waiting for all data to load before rendering
2. Slow localStorage access
3. Items data taking too long to fetch

**Solutions**:
1. Check DevTools Performance tab during login
2. Open DevTools > Application > Storage > LocalStorage
   - Look for `user` key containing JSON
   - If missing, login failed silently
3. Check Network tab for slow requests
4. Disable browser extensions (can slow localStorage)

**How to fix**:
- Already fixed in latest version (progressive rendering)
- Clear cache: `Settings → Privacy → Clear browsing data`
- Try private/incognito window

---

### Issue: "Login redirect loop - keeps going back to login"
**Symptoms**:
- Click "Login"
- Briefly see dashboard
- Redirected back to login page
- Infinite loop

**Root Causes**:
1. Cookie not being set properly
2. Middleware checking cookie before it's ready
3. Browser has cookies disabled
4. Private browsing mode

**Solutions**:
1. **Check if cookies are enabled**:
   - Open DevTools > Application > Cookies
   - Should show `authToken` cookie for your domain
   - If missing, enable cookies in browser settings

2. **Check browser console for errors**:
   - Look for `[v0]` prefixed messages
   - If you see "Cookie may not have been set", this is the issue

3. **Clear site data and try again**:
   ```javascript
   // Run in console
   localStorage.clear();
   sessionStorage.clear();
   document.cookie = 'authToken=; path=/; max-age=0';
   location.href = '/login';
   ```

4. **Try different browser**:
   - Logout and try in Chrome/Firefox/Safari
   - If it works in one browser but not another, it's a browser-specific issue

---

### Issue: "Page takes too long to load after login"
**Symptoms**:
- Login works
- Dashboard appears slowly (> 3 seconds)
- Items page takes forever to load
- Sluggish navigation between pages

**Performance Diagnosis**:
1. Open DevTools > Performance tab
2. Click "Record"
3. Wait for page to fully load
4. Click "Stop"
5. Analyze the flame chart:
   - Red blocks = long tasks blocking the main thread
   - Yellow blocks = lower priority tasks
   - Blue blocks = rendering

**Solutions**:

**If dashboard is slow**:
```javascript
// Check how many items in database
// Run in console
db.items.count().then(count => {
  console.log(`Total items: ${count}`);
  if (count > 1000) {
    console.warn('Too many items! Consider archiving old items.');
  }
});
```

**If network is slow**:
- Open DevTools > Network tab
- Look for slow requests (> 1 second)
- Check if Supabase sync is happening (should see POST requests)
- If very slow, check internet speed

**If localStorage is slow**:
- Clear localStorage: `localStorage.clear()` in console
- Reload page
- If faster, too much data stored

---

### Issue: "Logout doesn't work - stays logged in"
**Symptoms**:
- Click logout button
- Still on dashboard
- Can still access protected pages

**Root Causes**:
1. Browser caching
2. Cookie not being deleted
3. Session storage issue

**Solutions**:
```javascript
// Manually clear everything
localStorage.clear();
sessionStorage.clear();
document.cookie = 'authToken=; path=/; max-age=0; SameSite=Strict';
location.href = '/login';
```

---

### Issue: "Different data on different devices"
**Symptoms**:
- Login on Device A, see items
- Login on Device B, don't see items
- Items not syncing between devices

**Root Causes**:
1. Supabase sync not working
2. Different user IDs on different devices
3. Network connectivity issue

**Solutions**:
1. Check browser console for sync errors
2. All demo users should use same "Bharat" account
3. Verify internet connection
4. Check Supabase status

**To verify sync is working**:
```javascript
// Check sync messages in console
// Should see '[v0] Syncing items to Supabase'
// If not, sync might be disabled or failing
```

---

### Issue: "Application keeps crashing / refreshing"
**Symptoms**:
- Page keeps reloading
- Error messages in console
- App becomes unusable

**Root Causes**:
1. Corrupted localStorage data
2. Error in component rendering
3. Infinite redirect loop

**Emergency Recovery**:
```javascript
// Complete reset - run in console
localStorage.clear();
sessionStorage.clear();
document.cookie = 'authToken=; path=/; max-age=0; SameSite=Strict';
indexedDB.deleteDatabase('dukan');
location.href = '/login';
```

Then:
1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Close all tabs and reopen
3. Try in private/incognito window

---

## Advanced Debugging

### Enable Advanced Logging
Add to browser console:
```javascript
// Log all auth changes
const originalSetUser = window.setUser;
window.setUser = function(user) {
  console.log('[Auth] setUser called with:', user);
  return originalSetUser?.apply(this, arguments);
};

// Log all route changes
window.addEventListener('popstate', () => {
  console.log('[Route] Navigation occurred:', window.location.pathname);
});
```

### Check Supabase Sync Status
```javascript
// In browser console
// This requires the app to expose these functions (development only)
await db.items.toArray().then(items => {
  console.log(`Local items: ${items.length}`);
});

// Check network requests in DevTools > Network tab
// Look for POST requests to supabase endpoints
```

### Monitor Performance
```javascript
// Create a performance report
const perfReport = {
  fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
  lcp: performance.getEntriesByName('largest-contentful-paint')[0]?.startTime,
  cls: performance.getEntriesByName('layout-shift')
    .reduce((sum, entry) => sum + entry.value, 0),
};
console.table(perfReport);
```

---

## Performance Optimization Checklist

### Browser-Level
- [ ] Clear browser cache (DevTools > Storage > Cache Storage)
- [ ] Clear browsing data (Settings > Privacy > Clear browsing data)
- [ ] Disable extensions
- [ ] Use modern browser (Chrome 90+, Firefox 88+, Safari 14+)

### Application-Level
- [ ] Check no console errors (DevTools > Console)
- [ ] Network requests complete within 2 seconds
- [ ] LocalStorage < 5MB (check DevTools > Application > LocalStorage)
- [ ] No infinite redirect loops

### Device-Level
- [ ] Restart browser
- [ ] Restart device
- [ ] Check internet speed (speedtest.net)
- [ ] Try different network (WiFi vs mobile data)

---

## Collecting Logs for Support

If issues persist, collect this information:

```javascript
// Run this in console and copy the output
const systemInfo = {
  userAgent: navigator.userAgent,
  localStorage: localStorage.getItem('user'),
  indexedDBSize: await navigator.storage.estimate(),
  cookies: document.cookie.split('; '),
  performance: {
    fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
    lcp: performance.getEntriesByName('largest-contentful-paint')[0]?.startTime,
  },
  timestamp: new Date().toISOString(),
};

console.log(JSON.stringify(systemInfo, null, 2));
```

Include this with your bug report.

---

## Browser-Specific Issues

### Chrome
- **Issue**: Slow performance in DevTools open
- **Solution**: Close DevTools or disable breakpoints

### Firefox
- **Issue**: Slow localStorage access
- **Solution**: Disable extensions, especially privacy ones

### Safari
- **Issue**: Cookies not persisting in private mode
- **Solution**: Use normal browsing (non-private)

### Mobile Safari (iOS)
- **Issue**: App takes long to load
- **Solution**: Add to home screen → Open in standalone mode

---

## Getting More Help

### Collect Diagnostic Data
```javascript
// Copy this and include in support request
const diagnostics = {
  timestamp: new Date().toISOString(),
  url: window.location.href,
  userAgent: navigator.userAgent,
  isOnline: navigator.onLine,
  storageSize: JSON.stringify(localStorage).length,
  storageKeys: Object.keys(localStorage),
  consoleErrors: [] // Check console tab for errors
};
console.log(diagnostics);
```

### Check Status Page
Visit the Dukan status page to see if there are known issues:
- Check if Supabase is operational
- Check if any services are down

### Contact Support
When reporting issues, include:
1. Browser and version
2. Device type (Desktop/Mobile/Tablet)
3. Steps to reproduce
4. Console error messages
5. Diagnostic data from above

---

## Performance Monitoring

To monitor performance in real-time:

```javascript
// Add this to browser console
const monitor = {
  logMetrics: () => {
    const metrics = performance.getEntriesByType('measure');
    metrics.forEach(metric => {
      console.log(`${metric.name}: ${metric.duration.toFixed(2)}ms`);
    });
  },
  checkHealth: () => {
    console.log({
      online: navigator.onLine,
      storageUsed: JSON.stringify(localStorage).length,
      cacheSize: await navigator.storage.estimate(),
      fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
    });
  }
};

// Run diagnostics
monitor.checkHealth();
```

---

## Prevention

To avoid issues in the future:

1. **Regular backups**: Export data regularly (`Settings > Export Data`)
2. **Monitor performance**: Keep browser DevTools Performance tab open occasionally
3. **Keep browser updated**: Update your browser to the latest version
4. **Clear cache weekly**: Regular cleanup prevents corruption
5. **Use stable internet**: Avoid login on unreliable networks

