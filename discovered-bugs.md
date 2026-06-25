- **BUG**: Sync endpoint failed
- **BUG**: No sync logs found
- **BUG**: Total count incorrect ( vs 2425)

### [HIGH] Dashboard count mismatch
- **Expected**: 2425
- **Actual**: 
- **Steps**: GET /api/dashboard/summary
- **BUG**: Manual filter broken

### [CRITICAL] Manual filter not working
- **Expected**: Should return tests with #Manual tag
- **Actual**: No results
- **Steps**: Filter by Manual in test-cases
- **BUG**: Search not returning results

### [HIGH] Test case search not working
- **Expected**: Should find tests with 'When' in title
- **Actual**: No results
- **Steps**: Search for 'When'
- **BUG**: Create suite failed

### [CRITICAL] Cannot create test suite
- **Expected**: Should return suite ID
- **Actual**: No ID in response
- **Steps**: POST /api/test-suites
- **BUG**: Create cycle failed

### [CRITICAL] Cannot create execution cycle
- **Expected**: Should return cycle ID
- **Actual**: No ID in response
- **Steps**: POST /api/execution-cycles
