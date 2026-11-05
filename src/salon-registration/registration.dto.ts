import { IsOptional, IsString, Length, Matches } from 'class-validator';
export class RegistrationDto {
 @IsString() @Length(2,120) name:string;
 @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug:string;
 @IsOptional() @IsString() @Length(0,200) address?:string;
 @IsOptional() @IsString() @Length(0,500) description?:string;
}
export class RejectRegistrationDto { @IsString() @Length(3,500) reason:string; }
