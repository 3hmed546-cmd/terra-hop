export default function ShopLoading() {
  return (
    <main className="min-h-screen bg-offwhite py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="mb-10 text-center animate-pulse">
        <div className="h-10 w-48 bg-stone-200 rounded-md mx-auto mb-3" />
        <div className="h-5 w-72 bg-stone-200 rounded-md mx-auto" />
      </div>

      {/* Categories Filter Skeleton */}
      <div className="flex justify-center gap-3 mb-10 overflow-x-auto py-2 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 w-24 bg-stone-200 rounded-full" />
        ))}
      </div>

      {/* Product Cards Grid Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="animate-pulse flex flex-col">
            <div className="aspect-[4/5] bg-stone-200 rounded-xl mb-3" />
            <div className="h-4 bg-stone-200 rounded w-3/4 mb-2" />
            <div className="h-4 bg-stone-200 rounded w-1/3" />
          </div>
        ))}
      </div>
    </main>
  );
}
