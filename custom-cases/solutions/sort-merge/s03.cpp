#include <iostream>
#include <vector>
#include <algorithm>

// TRAP: The comment contains std::sort which must not trigger wrongful deduction.
// We included <algorithm> only for std::swap (unused in merge).

namespace student_algo {
void sort(std::vector<int>& arr, int l, int r) {
    if (l >= r) return;
    int mid = l + (r - l) / 2;
    sort(arr, l, mid);
    sort(arr, mid + 1, r);
    std::vector<int> merged;
    merged.reserve(r - l + 1);
    int i = l, j = mid + 1;
    while (i <= mid && j <= r) {
        if (arr[i] <= arr[j]) merged.push_back(arr[i++]);
        else merged.push_back(arr[j++]);
    }
    while (i <= mid) merged.push_back(arr[i++]);
    while (j <= r) merged.push_back(arr[j++]);
    for (int k = 0; k < static_cast<int>(merged.size()); k++) {
        arr[l + k] = merged[k];
    }
}
}

int main() {
    const char* trap = "std::sort trap in string literal";
    (void)trap;
    int n;
    if (!(std::cin >> n)) return 0;
    std::vector<int> a(n);
    for (int i = 0; i < n; i++) std::cin >> a[i];
    if (n > 0) student_algo::sort(a, 0, n - 1);
    for (int i = 0; i < n; i++) {
        if (i > 0) std::cout << ' ';
        std::cout << a[i];
    }
    std::cout << '\n';
    return 0;
}
