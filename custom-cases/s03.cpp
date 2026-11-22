#include <iostream>
#include <vector>
#include <algorithm>

// TRAP: The comment contains std::sort which must not trigger wrongful deduction.
// We included <algorithm> only for std::swap.

namespace student_algo {
void sort(std::vector<int>& arr, int l, int r) {
    if (l >= r) return;
    int mid = l + (r - l) / 2;
    sort(arr, l, mid);
    sort(arr, mid + 1, r);
    // Standard merge using std::swap when applicable
    int i = l, j = mid + 1;
    while (i <= mid && j <= r) {
        if (arr[i] > arr[j]) {
            std::swap(arr[i], arr[j]);
        }
        i++;
    }
}
}

int main() {
    std::cout << "std::sort trap in string literal" << std::endl;
    std::vector<int> a = {4, 1, 3, 2};
    student_algo::sort(a, 0, a.size() - 1);
    return 0;
}

