#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AudioStreamPlayer, NSObject)

RCT_EXTERN_METHOD(initialize:(nonnull NSNumber *)sampleRate
                  channels:(nonnull NSNumber *)channels)

RCT_EXTERN_METHOD(writeBuffer:(nonnull NSString *)base64Data)

RCT_EXTERN_METHOD(stop)

@end
