if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "C:/Users/Hp/.gradle/caches/8.12/transforms/f8f59aba63c52f2f365112d4d4d9e2dc/transformed/hermes-android-0.78.2-release/prefab/modules/libhermes/libs/android.armeabi-v7a/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/Hp/.gradle/caches/8.12/transforms/f8f59aba63c52f2f365112d4d4d9e2dc/transformed/hermes-android-0.78.2-release/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

