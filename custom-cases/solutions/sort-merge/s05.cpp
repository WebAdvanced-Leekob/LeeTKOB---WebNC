#include <iostream>
#include <vector>

// Disguised semantic violation: function is named mergeSort
// but it does not implement divide and conquer or recursion.
// It uses an iterative bubble sort instead.
void mergeSort(std::vector<int>& arr, int left, int right) {
    int n = arr.size();
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                int temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
            }
        }
    }
}

int main() {
    int n;
    if (!(std::cin >> n)) return 0;
    std::vector<int> a(n);
    for (int i = 0; i < n; i++) std::cin >> a[i];
    if (n > 0) mergeSort(a, 0, n - 1);
    for (int i = 0; i < n; i++) {
        if (i > 0) std::cout << ' ';
        std::cout << a[i];
    }
    std::cout << '\n';
    return 0;
}
